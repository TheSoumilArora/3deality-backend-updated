// src/subscribers/order-to-shiprocket.ts
// If TypeScript complains about types, you can switch imports to 'any' to keep moving.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createShiprocketOrder } from "../integrations/shiprocket/client"

export default async function orderToShiprocket(subArgs: SubscriberArgs) {
  const { data, container } = subArgs
  const logger = (container as any)?.logger || console

  try {
    const orderId = (data as any)?.id || (data as any)?.order_id
    if (!orderId) {
      logger.warn?.("Shiprocket subscriber: missing order id in event", data)
      return
    }

    // Depending on your generated app, the service name may differ. If this throws,
    // log available container keys or fetch via the Order Module pattern you use.
    const orderService: any = container.resolve("orderService")
    const order = await orderService.retrieve(orderId, {
      relations: ["items", "shipping_address", "billing_address"],
    })

    const billing = order.billing_address || order.shipping_address
    const shipping = order.shipping_address
    const pickup = process.env.SHIPROCKET_DEFAULT_PICKUP || "Primary"

    const payload: any = {
      order_id: order.display_id || order.id,
      order_date: new Date(order.created_at).toISOString().slice(0, 19).replace("T", " "),
      pickup_location: pickup,

      billing_customer_name: billing?.first_name ?? "",
      billing_last_name: billing?.last_name ?? "",
      billing_address: billing?.address_1 ?? "",
      billing_address_2: billing?.address_2 ?? "",
      billing_city: billing?.city ?? "",
      billing_pincode: billing?.postal_code ?? "",
      billing_state: billing?.province ?? billing?.province_code ?? "",
      billing_country: (billing?.country_code || "IN").toUpperCase(),
      billing_email: order.email,
      billing_phone: billing?.phone ?? shipping?.phone ?? "",

      shipping_is_billing:
        !shipping || JSON.stringify(shipping) === JSON.stringify(billing),
      ...(shipping
        ? {
            shipping_customer_name: shipping.first_name,
            shipping_last_name: shipping.last_name || "",
            shipping_address: shipping.address_1,
            shipping_address_2: shipping.address_2 || "",
            shipping_city: shipping.city,
            shipping_pincode: shipping.postal_code,
            shipping_state: shipping.province || shipping.province_code,
            shipping_country: (shipping.country_code || "IN").toUpperCase(),
          }
        : {}),

      order_items: order.items.map((it: any) => ({
        name: it.title,
        sku: it.sku || it.variant_id || it.id,
        units: it.quantity,
        selling_price: it.unit_price,
        discount: 0,
        tax: 0,
      })),

      payment_method: order.payment_status === "captured" ? "Prepaid" : "COD",
      sub_total: order.subtotal ?? order.total ?? 0,

      length: 10,
      breadth: 10,
      height: 2,
      weight: 0.5,
    }

    // channel_id auto-injected in client if env present
    const result = await createShiprocketOrder(payload)
    logger.info?.(`Shiprocket: created order ${JSON.stringify(result)}`)
  } catch (e: any) {
    ;((container as any)?.logger || console).error?.(
      `Shiprocket subscriber error: ${e?.message}`
    )
  }
}

// Start with "order.placed". If you don't see it fire, try "order.completed" or "order.payment_captured".
export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "shiprocket-order-create" },
}
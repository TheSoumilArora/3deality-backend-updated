// Make this file permissive so it compiles across v2 minors.
import { createShiprocketOrder } from "../integrations/shiprocket/client"

export default async function orderToShiprocket(subArgs: any) {
  // Some starters pass { data, container }, others a slightly different shape.
  const container = subArgs?.container ?? subArgs?.context?.container
  const data = subArgs?.data ?? subArgs?.payload ?? subArgs?.event?.data

  const logger = (container?.logger) || console
  try {
    const orderId = data?.id || data?.order_id
    if (!orderId) {
      logger.warn?.("Shiprocket: event missing order id", data)
      return
    }

    // If your app uses a different resolver, adjust here.
    const orderService: any = container.resolve("orderService")
    const order = await orderService.retrieve(orderId, {
      relations: ["items", "shipping_address", "billing_address"],
    })

    // Idempotency: skip if already linked
    if (order?.metadata?.shiprocket_order_id) {
      logger.info?.("Shiprocket: already linked; skipping")
      return
    }

    const billing = order.billing_address || order.shipping_address
    const shipping = order.shipping_address
    const payload: any = {
      order_id: order.display_id || order.id,
      order_date: new Date(order.created_at).toISOString().slice(0, 19).replace("T", " "),
      pickup_location: process.env.SHIPROCKET_DEFAULT_PICKUP || "Primary",

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
      ...(shipping ? {
        shipping_customer_name: shipping.first_name,
        shipping_last_name: shipping.last_name || "",
        shipping_address: shipping.address_1,
        shipping_address_2: shipping.address_2 || "",
        shipping_city: shipping.city,
        shipping_pincode: shipping.postal_code,
        shipping_state: shipping.province || shipping.province_code,
        shipping_country: (shipping.country_code || "IN").toUpperCase(),
      } : {}),

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

      length: 10, breadth: 10, height: 2, weight: 0.5,
    }

    const result = await createShiprocketOrder(payload)

    // Save SR id back on the order (best-effort)
    const srId =
      result?.order_id || result?.shipment_id || result?.id || result?.data?.order_id
    try {
      await orderService.update(order.id, {
        metadata: { ...(order.metadata || {}), shiprocket_order_id: srId },
      })
    } catch (e: any) {
      logger.warn?.(`Shiprocket: metadata save failed: ${e?.message}`)
    }

    logger.info?.(`Shiprocket: created ${JSON.stringify(result)}`)
  } catch (e: any) {
    (container?.logger || console).error?.(`Shiprocket subscriber error: ${e?.message}`)
  }
}

// No strict typing here to avoid version drift issues
export const config = {
  event: "order.placed", // if it doesn't fire, try: "order.completed"
  context: { subscriberId: "shiprocket-order-create" },
} as const
// src/api/admin/shiprocket/orders/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { createShiprocketOrder } from "../../../../integrations/shiprocket/client"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as any

  if (!b.order_id || !b.billing || !(Array.isArray(b.items) && b.items.length)) {
    return res
      .status(400)
      .json({ message: "order_id, billing, and items[] are required" })
  }

  const pickup =
    b.pickup_location || process.env.SHIPROCKET_DEFAULT_PICKUP || "Primary"

  // Shape payload to Shiprocket "adhoc" order format
  const payload = {
    order_id: b.order_id,
    order_date:
      b.order_date ||
      new Date().toISOString().slice(0, 19).replace("T", " "), // "YYYY-MM-DD HH:mm:ss"
    pickup_location: pickup,

    billing_customer_name: b.billing.first_name,
    billing_last_name: b.billing.last_name || "",
    billing_address: b.billing.address_1,
    billing_address_2: b.billing.address_2 || "",
    billing_city: b.billing.city,
    billing_pincode: b.billing.postal_code,
    billing_state: b.billing.province || b.billing.state,
    billing_country: (b.billing.country_code || "IN").toUpperCase(),
    billing_email: b.billing.email,
    billing_phone: b.billing.phone,

    shipping_is_billing: !b.shipping,
    ...(b.shipping
      ? {
          shipping_customer_name: b.shipping.first_name,
          shipping_last_name: b.shipping.last_name || "",
          shipping_address: b.shipping.address_1,
          shipping_address_2: b.shipping.address_2 || "",
          shipping_city: b.shipping.city,
          shipping_pincode: b.shipping.postal_code,
          shipping_state: b.shipping.province || b.shipping.state,
          shipping_country: (b.shipping.country_code || "IN").toUpperCase(),
        }
      : {}),

    order_items: b.items.map((i: any) => ({
      name: i.title,
      sku: i.sku || i.variant_id || i.id,
      units: i.quantity,
      selling_price: i.unit_price ?? i.price ?? 0,
      discount: 0,
      tax: 0,
      hsn: i.hsn || undefined,
    })),

    payment_method: b.payment_method || "Prepaid", // or "COD"
    sub_total:
      typeof b.sub_total === "number"
        ? b.sub_total
        : b.items.reduce(
            (s: number, i: any) => s + (i.unit_price ?? 0) * i.quantity,
            0
          ),

    length: b.dimensions?.length ?? 10,
    breadth: b.dimensions?.breadth ?? 10,
    height: b.dimensions?.height ?? 2,
    weight: b.dimensions?.weight ?? 0.5,
  }

  const out = await createShiprocketOrder(payload)
  return res.json({ ok: true, shiprocket: out })
}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://jovick-dine-delivery.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function paystackRequest(path: string, body?: unknown) {
  const response = await fetch("https://api.paystack.co" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + PAYSTACK_SECRET_KEY,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result?.status) {
    throw new Error(result?.message || "Paystack request failed.");
  }
  return result.data;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature || !PAYSTACK_SECRET_KEY) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = bytesToHex(digest);
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function validateCart(userId: string, rawItems: unknown) {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 40) {
    throw new Error("Your cart is empty or contains too many items.");
  }
  const cleanItems: Array<Record<string, unknown>> = [];
  const subtotals = new Map<string, { subtotal: number; name: string }>();
  let foodSubtotal = 0;

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") throw new Error("Your cart contains an invalid item.");
    const item = raw as Record<string, unknown>;
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new Error("Item quantities must be between 1 and 50.");

    let restaurantId = "";
    let unitPrice = 0;
    let cleanItem: Record<string, unknown>;

    if (typeof item.preorder_request_id === "string") {
      const { data: request, error } = await admin
        .from("dish_preorder_requests")
        .select("id,customer_id,dish_name,quantity,accepted_price,accepted_restaurant_id,status")
        .eq("id", item.preorder_request_id)
        .eq("customer_id", userId)
        .eq("status", "accepted")
        .maybeSingle();
      if (error || !request || !request.accepted_restaurant_id || !request.accepted_price) {
        throw new Error("An accepted private pre-order is no longer available. Refresh your bag.");
      }
      if (qty !== Number(request.quantity)) {
        throw new Error("The quantity for a private pre-order must match the quantity agreed with the business.");
      }
      restaurantId = request.accepted_restaurant_id;
      unitPrice = Number(request.accepted_price);
      cleanItem = { preorder_request_id: request.id, qty };
    } else {
      const menuId = Number(item.id);
      if (!Number.isInteger(menuId) || menuId < 1) throw new Error("Your cart contains an invalid food item.");
      const { data: menuItem, error } = await admin
        .from("menu_items")
        .select("id,name,price,restaurant_id,is_available")
        .eq("id", menuId)
        .eq("is_available", true)
        .maybeSingle();
      if (error || !menuItem || !menuItem.restaurant_id) {
        throw new Error("One of the meals is no longer available. Refresh the menu.");
      }
      restaurantId = menuItem.restaurant_id;
      unitPrice = Number(menuItem.price);
      cleanItem = { id: menuItem.id, qty };
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id,name,status")
      .eq("id", restaurantId)
      .eq("status", "approved")
      .maybeSingle();
    if (restaurantError || !restaurant) throw new Error("A restaurant in your cart is not currently available.");

    const lineTotal = unitPrice * qty;
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 1) throw new Error("A food price could not be verified.");
    foodSubtotal += lineTotal;
    const existing = subtotals.get(restaurantId);
    subtotals.set(restaurantId, {
      subtotal: (existing?.subtotal || 0) + lineTotal,
      name: restaurant.name,
    });
    cleanItems.push(cleanItem);
  }

  if (!Number.isSafeInteger(foodSubtotal) || foodSubtotal < 1) throw new Error("Your checkout total is invalid.");
  return { cleanItems, subtotals, foodSubtotal };
}

async function finalize(sessionId: string) {
  const { data, error } = await admin.rpc("finalize_checkout_session", {
    p_checkout_session_id: sessionId,
  });
  if (error) throw new Error(error.message || "Orders could not be finalized.");
  return data || [];
}


async function recordGatewayFee(checkoutId: string, feeKobo: number) {
  if (!Number.isFinite(feeKobo) || feeKobo <= 0) return;
  const { error } = await admin.from("payment_allocations").insert({
    checkout_session_id: checkoutId,
    allocation_type: "gateway_fee",
    amount_kobo: Math.round(feeKobo),
    settlement_status: "not_applicable",
  });
  if (error && error.code !== "23505") throw error;
}

async function handleWebhook(request: Request) {
  const rawBody = await request.text();
  if (!(await validPaystackSignature(rawBody, request.headers.get("x-paystack-signature")))) {
    return json({ error: "Invalid webhook signature." }, 401);
  }
  const event = JSON.parse(rawBody);
  const eventName = String(event?.event || "");
  const reference = String(event?.data?.reference || "");
  if (!reference) return json({ received: true });

  const eventId = eventName + ":" + reference;
  const { data: priorEvent } = await admin
    .from("payment_events")
    .select("id,processed_at")
    .eq("provider_event_id", eventId)
    .maybeSingle();
  if (priorEvent?.processed_at) return json({ received: true, duplicate: true });

  if (eventName === "charge.success") {
    const verified = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
    const { data: checkout, error: checkoutError } = await admin
      .from("checkout_sessions")
      .select("id,total,currency,status,payment_reference")
      .eq("payment_reference", reference)
      .maybeSingle();
    if (checkoutError || !checkout) return json({ error: "Checkout reference not found." }, 404);
    if (verified.status !== "success" || verified.currency !== checkout.currency ||
      Number(verified.amount) !== Number(checkout.total) * 100 ||
      (verified.metadata?.checkout_id && verified.metadata.checkout_id !== checkout.id)) {
      return json({ error: "The verified payment does not match this checkout." }, 400);
    }

    const { error: eventError } = await admin.from("payment_events").upsert({
      provider: "paystack",
      provider_event_id: eventId,
      payment_reference: reference,
      event_type: eventName,
      payload: event,
    }, { onConflict: "provider,provider_event_id" });
    if (eventError) throw eventError;

    const { error: updateError } = await admin.from("checkout_sessions").update({
      status: "paid",
      provider_transaction_id: String(verified.id),
      provider_fee_kobo: Number(verified.fees || 0),
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", checkout.id).neq("status", "paid");
    if (updateError) throw updateError;

    await recordGatewayFee(checkout.id, Number(verified.fees || 0));
    await finalize(checkout.id);

    const { error: processedError } = await admin.from("payment_events").update({
      processed_at: new Date().toISOString(),
    }).eq("provider_event_id", eventId);
    if (processedError) throw processedError;
    return json({ received: true });
  }

  if (eventName === "charge.failed") {
    await admin.from("checkout_sessions").update({
      status: "payment_failed",
      updated_at: new Date().toISOString(),
    }).eq("payment_reference", reference).eq("status", "pending_payment");
  }
  return json({ received: true });
}

async function handleCreate(userId: string, body: Record<string, unknown>) {
  const paymentMethod = String(body.payment_method || "");
  if (!["paystack", "cash_on_delivery"].includes(paymentMethod)) {
    return json({ error: "Choose Paystack online payment or cash on delivery." }, 400);
  }
  const fields = ["customer_name", "customer_phone", "customer_email", "delivery_address", "delivery_area"];
  for (const field of fields) {
    if (typeof body[field] !== "string" || !(body[field] as string).trim()) {
      return json({ error: "Please complete your delivery details." }, 400);
    }
  }
  const idempotencyKey = String(body.idempotency_key || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return json({ error: "Refresh checkout and try again." }, 400);
  }

  const { data: existing } = await admin
    .from("checkout_sessions")
    .select("id,customer_id,status,payment_method,total,food_subtotal,delivery_fee,payment_reference,authorization_url,automatic_split,finalized_at")
    .eq("customer_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    if (existing.payment_method === "cash_on_delivery" && existing.status === "cash_due") {
      const orders = await finalize(existing.id);
      return json({
        checkout_id: existing.id,
        orders,
        total: existing.total,
        delivery_fee: existing.delivery_fee,
        payment_method: existing.payment_method,
        payment_status: "cash_due",
        reused: true
      });
    }
    if (existing.payment_reference && existing.authorization_url && existing.status === "pending_payment") {
      return json({
        checkout_id: existing.id,
        authorization_url: existing.authorization_url,
        total: existing.total,
        delivery_fee: existing.delivery_fee,
        automatic_split: existing.automatic_split,
        reused: true
      });
    }
    return json({ error: "This checkout attempt has already been used. Refresh the page to start a new checkout." }, 409);
  }

  const cart = await validateCart(userId, body.items);
  const area = String(body.delivery_area).trim();
  const stopCount = cart.subtotals.size;
  const { data: quote, error: quoteError } = await admin
    .from("delivery_fee_quotes")
    .select("fee,delivery_plan")
    .eq("delivery_area", area)
    .eq("restaurant_stop_count", stopCount)
    .eq("active", true)
    .maybeSingle();
  if (quoteError || !quote) {
    return json({ error: "A combined delivery quote is not configured for this area and number of restaurant stops yet. Please contact support before placing this order." }, 409);
  }

  const total = cart.foodSubtotal + Number(quote.fee);
  const { data: checkout, error: insertError } = await admin.from("checkout_sessions").insert({
    customer_id: userId,
    status: paymentMethod === "cash_on_delivery" ? "cash_due" : "pending_payment",
    payment_method: paymentMethod,
    currency: "NGN",
    food_subtotal: cart.foodSubtotal,
    delivery_fee: Number(quote.fee),
    total,
    commission_rate: 0.1,
    delivery_area: area,
    delivery_plan: quote.delivery_plan,
    restaurant_stop_count: stopCount,
    customer_name: String(body.customer_name).trim(),
    customer_phone: String(body.customer_phone).trim(),
    customer_email: String(body.customer_email).trim(),
    delivery_address: String(body.delivery_address).trim(),
    delivery_notes: String(body.delivery_notes || "").trim(),
    requested_for: body.requested_for || null,
    cart_items: cart.cleanItems,
    idempotency_key: idempotencyKey,
  }).select("id,total,food_subtotal,delivery_fee").single();
  if (insertError || !checkout) {
    throw new Error(insertError?.message || "Checkout could not be created.");
  }

  if (paymentMethod === "cash_on_delivery") {
    const orders = await finalize(checkout.id);
    return json({
      checkout_id: checkout.id,
      orders,
      food_subtotal: checkout.food_subtotal,
      delivery_fee: checkout.delivery_fee,
      total: checkout.total,
      payment_method: paymentMethod,
      payment_status: "cash_due",
    });
  }

  let splitCode: string | null = null;
  const restaurantIds = Array.from(cart.subtotals.keys());
  const { data: accounts } = await admin
    .from("restaurant_payment_accounts")
    .select("restaurant_id,subaccount_code")
    .in("restaurant_id", restaurantIds)
    .eq("enabled", true)
    .not("verified_at", "is", null)
    .not("subaccount_code", "is", null);

  const shares = (accounts || []).map((account) => {
    const order = cart.subtotals.get(account.restaurant_id);
    if (!order || !account.subaccount_code) return null;
    const commission = Math.round(order.subtotal * 0.1);
    const net = order.subtotal - commission;
    return net > 0 ? { subaccount: account.subaccount_code, share: net * 100 } : null;
  }).filter(Boolean);

  if (shares.length) {
    try {
      const split = await paystackRequest("/split", {
        name: "Jovick checkout " + checkout.id.slice(0, 8),
        type: "flat",
        currency: "NGN",
        subaccounts: shares,
        bearer_type: "account",
      });
      splitCode = split.split_code;
    } catch {
      splitCode = null;
    }
  }

  const reference = "JDDC-" + checkout.id.replaceAll("-", "").toUpperCase();
  try {
    const transaction = await paystackRequest("/transaction/initialize", {
      email: String(body.customer_email).trim(),
      amount: total * 100,
      currency: "NGN",
      reference,
      callback_url: SITE_URL + "/payment-result.html?checkout_id=" + encodeURIComponent(checkout.id),
      metadata: { checkout_id: checkout.id, customer_id: userId },
      ...(splitCode ? { split_code: splitCode } : {}),
    });
    const { error: updateError } = await admin.from("checkout_sessions").update({
      payment_reference: transaction.reference,
      authorization_url: transaction.authorization_url,
      automatic_split: Boolean(splitCode),
      updated_at: new Date().toISOString(),
    }).eq("id", checkout.id);
    if (updateError) throw updateError;
    return json({
      checkout_id: checkout.id,
      authorization_url: transaction.authorization_url,
      reference: transaction.reference,
      food_subtotal: checkout.food_subtotal,
      delivery_fee: checkout.delivery_fee,
      total: checkout.total,
      payment_method: paymentMethod,
      automatic_split: Boolean(splitCode),
    });
  } catch (error) {
    await admin.from("checkout_sessions").update({
      status: "payment_failed",
      updated_at: new Date().toISOString(),
    }).eq("id", checkout.id);
    throw error;
  }
}

async function handleVerify(userId: string, body: Record<string, unknown>) {
  const checkoutId = String(body.checkout_id || "");
  const { data: checkout, error } = await admin
    .from("checkout_sessions")
    .select("id,customer_id,status,total,currency,payment_reference,paid_at")
    .eq("id", checkoutId)
    .eq("customer_id", userId)
    .maybeSingle();
  if (error || !checkout) return json({ error: "Checkout not found." }, 404);
  if (checkout.status === "paid") {
    const orders = await finalize(checkout.id);
    return json({ success: true, checkout_id: checkout.id, orders });
  }
  const reference = String(body.reference || checkout.payment_reference || "");
  if (!reference || reference !== checkout.payment_reference) {
    return json({ error: "The payment reference does not match this checkout." }, 400);
  }
  const verified = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
  if (verified.status !== "success" || verified.currency !== checkout.currency ||
    Number(verified.amount) !== Number(checkout.total) * 100 ||
    verified.metadata?.checkout_id !== checkout.id) {
    return json({ success: false, status: verified.status || "pending", message: "Payment has not been verified yet." }, 202);
  }
  const { error: updateError } = await admin.from("checkout_sessions").update({
    status: "paid",
    provider_transaction_id: String(verified.id),
    provider_fee_kobo: Number(verified.fees || 0),
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", checkout.id).neq("status", "paid");
  if (updateError) throw updateError;
  await recordGatewayFee(checkout.id, Number(verified.fees || 0));
  const orders = await finalize(checkout.id);
  return json({ success: true, checkout_id: checkout.id, orders });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    if (request.headers.has("x-paystack-signature")) return await handleWebhook(request);
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Please sign in before checkout." }, 401);
    const body = await request.json();
    const action = String(body.action || "create");
    if (action === "verify") return await handleVerify(user.id, body);
    if (action === "create") return await handleCreate(user.id, body);
    return json({ error: "Unsupported checkout action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Checkout could not be completed." }, 400);
  }
});

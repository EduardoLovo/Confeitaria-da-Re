import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------
// Mocks: server-only, after(), Supabase (service_role) e aviso da loja
// ---------------------------------------------------------------
vi.mock('server-only', () => ({}))

const afterCallbacks: (() => unknown)[] = []
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (cb: () => unknown) => afterCallbacks.push(cb),
}))

const notifyOwnerNewOrder = vi.fn()
vi.mock('@/lib/notifications/notify-owner', () => ({ notifyOwnerNewOrder }))

/** Respostas das consultas, na ordem em que o código as faz. */
let queryResults: { data: unknown; error: unknown }[] = []
const updates: unknown[] = []
const rpc = vi.fn()

function builder() {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order']) b[m] = () => b
  b.update = (values: unknown) => {
    updates.push(values)
    return b
  }
  b.maybeSingle = b.single = async () => queryResults.shift() ?? { data: null, error: null }
  return b
}
vi.mock('@/lib/supabase/admin', () => ({
  createServiceClient: () => ({ from: () => builder(), rpc }),
}))

const { createCheckoutLink, checkPayment, InfinitePayError } = await import('@/lib/payments/infinitepay')
const { confirmOnlinePayment, ensurePaymentLink } = await import('@/lib/payments/online-payment')
const webhook = await import('@/app/api/pagamentos/infinitepay/route')
const paymentReturn = await import('@/app/pedido/[id]/pagamento/route')

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function lastFetchBody() {
  return JSON.parse(fetchMock.mock.calls.at(-1)![1].body)
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('INFINITEPAY_HANDLE', '$renata-do-couto-soares')
  vi.stubEnv('SITE_URL', 'https://loja.test')
  queryResults = []
  updates.length = 0
  afterCallbacks.length = 0
  fetchMock.mockReset()
  rpc.mockReset()
  notifyOwnerNewOrder.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------
describe('API da InfinitePay', () => {
  it('cria o link com a InfiniteTag sem $ e preços em centavos', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: 'https://checkout.infinitepay.io/renata/abc' }))
    const url = await createCheckoutLink({
      orderNsu: ORDER_ID,
      items: [{ description: 'Brigadeiro', quantity: 2, priceCents: 350 }],
      redirectUrl: 'https://loja.test/volta',
      webhookUrl: 'https://loja.test/hook',
      customer: { name: 'Maria', phoneNumber: '+5511987654321' },
    })
    expect(url).toBe('https://checkout.infinitepay.io/renata/abc')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.checkout.infinitepay.io/links')
    expect(lastFetchBody()).toEqual({
      handle: 'renata-do-couto-soares',
      order_nsu: ORDER_ID,
      redirect_url: 'https://loja.test/volta',
      webhook_url: 'https://loja.test/hook',
      items: [{ description: 'Brigadeiro', quantity: 2, price: 350 }],
      customer: { name: 'Maria', phone_number: '+5511987654321' },
    })
  })

  it('aceita o link em outros nomes de campo e falha se não vier nenhum', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ link: 'https://x.test/a' }))
    const input = { orderNsu: ORDER_ID, items: [], redirectUrl: 'r', webhookUrl: 'w' }
    await expect(createCheckoutLink(input)).resolves.toBe('https://x.test/a')
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await expect(createCheckoutLink(input)).rejects.toBeInstanceOf(InfinitePayError)
  })

  it('erro HTTP e falta da InfiniteTag viram InfinitePayError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500))
    await expect(checkPayment({ orderNsu: ORDER_ID, transactionNsu: 't', slug: 's' })).rejects.toThrow('HTTP 500')
    vi.stubEnv('INFINITEPAY_HANDLE', '')
    await expect(checkPayment({ orderNsu: ORDER_ID, transactionNsu: 't', slug: 's' })).rejects.toThrow('INFINITEPAY_HANDLE')
  })
})

// ---------------------------------------------------------------
describe('ensurePaymentLink', () => {
  const awaiting = {
    id: ORDER_ID,
    number: 101,
    status: 'awaiting_payment',
    payment_url: null,
    payment_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    customer_name: 'Maria Silva',
    customer_phone: '11987654321',
    fulfillment: 'delivery',
    delivery_fee_cents: 800,
    cep: '01001000',
    street: 'Rua A',
    street_number: '10',
    complement: null,
    zone_name_snapshot: 'Centro',
    items: [
      { name_snapshot: 'Trufa', quantity: 1, unit_price_cents: 700, sort_order: 2 },
      { name_snapshot: 'Brigadeiro', quantity: 10, unit_price_cents: 350, sort_order: 1 },
    ],
  }

  it('cria o link com itens na ordem + taxa de entrega e salva no pedido', async () => {
    queryResults = [{ data: awaiting, error: null }, { data: { payment_url: 'https://pay.test/1' }, error: null }]
    fetchMock.mockResolvedValue(jsonResponse({ url: 'https://pay.test/1' }))

    await expect(ensurePaymentLink(ORDER_ID)).resolves.toEqual({ ok: true, url: 'https://pay.test/1' })
    const body = lastFetchBody()
    expect(body.items).toEqual([
      { description: 'Brigadeiro', quantity: 10, price: 350 },
      { description: 'Trufa', quantity: 1, price: 700 },
      { description: 'Taxa de entrega', quantity: 1, price: 800 },
    ])
    expect(body.redirect_url).toBe(`https://loja.test/pedido/${ORDER_ID}/pagamento`)
    expect(body.webhook_url).toBe('https://loja.test/api/pagamentos/infinitepay')
    expect(body.customer).toEqual({ name: 'Maria Silva', phone_number: '+5511987654321' })
    expect(body.address).toMatchObject({ cep: '01001000', neighborhood: 'Centro', number: '10' })
    expect(updates).toEqual([{ payment_url: 'https://pay.test/1' }])
  })

  it('reaproveita o link existente sem chamar a InfinitePay', async () => {
    queryResults = [{ data: { ...awaiting, payment_url: 'https://pay.test/old' }, error: null }]
    await expect(ensurePaymentLink(ORDER_ID)).resolves.toEqual({ ok: true, url: 'https://pay.test/old' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recusa pedido vencido, já pago ou inexistente', async () => {
    queryResults = [{ data: { ...awaiting, payment_expires_at: new Date(Date.now() - 1000).toISOString() }, error: null }]
    await expect(ensurePaymentLink(ORDER_ID)).resolves.toEqual({ ok: false, reason: 'expired' })
    queryResults = [{ data: { ...awaiting, status: 'received' }, error: null }]
    await expect(ensurePaymentLink(ORDER_ID)).resolves.toEqual({ ok: false, reason: 'not_awaiting_payment' })
    await expect(ensurePaymentLink('nao-e-uuid')).resolves.toEqual({ ok: false, reason: 'not_found' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------
describe('confirmOnlinePayment', () => {
  const input = { orderId: ORDER_ID, transactionNsu: 'TX1', slug: 'inv-1', receiptUrl: 'https://recibo.test/1' }
  const paid = { success: true, paid: true, amount: 4300, paid_amount: 4390, installments: 3, capture_method: 'credit_card' }

  it('não confia no aviso: consulta a InfinitePay e para se não estiver pago', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: false }))
    await expect(confirmOnlinePayment(input)).resolves.toBe('not_paid')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.checkout.infinitepay.io/payment_check')
    expect(lastFetchBody()).toEqual({
      handle: 'renata-do-couto-soares',
      order_nsu: ORDER_ID,
      transaction_nsu: 'TX1',
      slug: 'inv-1',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('recusa valor menor que o total do pedido', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...paid, amount: 100, paid_amount: 100 }))
    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    await expect(confirmOnlinePayment(input)).resolves.toBe('amount_mismatch')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('confirma, grava o valor pago (com juros) e avisa a loja uma vez', async () => {
    fetchMock.mockResolvedValue(jsonResponse(paid))
    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    rpc.mockResolvedValue({ data: { result: 'confirmed', number: 101 }, error: null })

    await expect(confirmOnlinePayment(input)).resolves.toBe('confirmed')
    expect(rpc).toHaveBeenCalledWith('confirm_order_payment', {
      p_order_id: ORDER_ID,
      p_transaction_nsu: 'TX1',
      p_paid_amount_cents: 4390,
      p_capture_method: 'credit_card',
      p_receipt_url: 'https://recibo.test/1',
    })
    afterCallbacks.forEach((cb) => cb())
    expect(notifyOwnerNewOrder).toHaveBeenCalledExactlyOnceWith(ORDER_ID)
  })

  it('já pago não avisa de novo; pago após cancelamento avisa com alerta', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(paid))
    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    rpc.mockResolvedValueOnce({ data: { result: 'already_paid', number: 101 }, error: null })
    await expect(confirmOnlinePayment(input)).resolves.toBe('already_paid')
    expect(afterCallbacks).toHaveLength(0)

    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    rpc.mockResolvedValueOnce({ data: { result: 'paid_after_cancel', number: 101 }, error: null })
    await expect(confirmOnlinePayment(input)).resolves.toBe('paid_after_cancel')
    afterCallbacks.forEach((cb) => cb())
    expect(notifyOwnerNewOrder).toHaveBeenCalledExactlyOnceWith(ORDER_ID, { paidAfterCancel: true })
  })

  it('só guarda comprovante https', async () => {
    fetchMock.mockResolvedValue(jsonResponse(paid))
    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    rpc.mockResolvedValue({ data: { result: 'confirmed', number: 101 }, error: null })
    await confirmOnlinePayment({ ...input, receiptUrl: 'javascript:alert(1)' })
    expect(rpc.mock.calls[0][1].p_receipt_url).toBeNull()
  })
})

// ---------------------------------------------------------------
describe('webhook POST /api/pagamentos/infinitepay', () => {
  const post = (body: unknown) =>
    webhook.POST(
      new NextRequest('https://loja.test/api/pagamentos/infinitepay', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    )
  const valid = { order_nsu: ORDER_ID, transaction_nsu: 'TX1', invoice_slug: 'inv-1', amount: 4300, paid_amount: 4300 }

  it('ignora (200) corpo inválido ou de outro sistema, sem consultar nada', async () => {
    expect((await post('não é json')).status).toBe(200)
    expect((await post({ ...valid, order_nsu: 'pedido-123' })).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('200 quando confirma; 400 (tentar de novo) se ainda não pago ou se falhar', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: true, amount: 4300, paid_amount: 4300 }))
    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    rpc.mockResolvedValue({ data: { result: 'confirmed', number: 101 }, error: null })
    expect((await post(valid)).status).toBe(200)

    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: false }))
    expect((await post(valid)).status).toBe(400)

    fetchMock.mockRejectedValue(new Error('rede'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await post(valid)).status).toBe(400)
  })
})

// ---------------------------------------------------------------
describe('volta do checkout GET /pedido/[id]/pagamento', () => {
  const get = (id: string, query = '') =>
    paymentReturn.GET(new NextRequest(`https://loja.test/pedido/${id}/pagamento${query}`), {
      params: Promise.resolve({ id }),
    })

  it('confere o pagamento e leva para a página do pedido (303)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: true, amount: 4300, paid_amount: 4300 }))
    queryResults = [{ data: { total_cents: 4300 }, error: null }]
    rpc.mockResolvedValue({ data: { result: 'confirmed', number: 101 }, error: null })

    const res = await get(ORDER_ID, `?order_nsu=${ORDER_ID}&transaction_nsu=TX1&slug=inv-1&capture_method=pix`)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`https://loja.test/pedido/${ORDER_ID}`)
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('não confere quando o order_nsu é de outro pedido; marca pendente se não pago', async () => {
    let res = await get(ORDER_ID, `?order_nsu=22222222-2222-4222-8222-222222222222&transaction_nsu=TX1&slug=s`)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe(`https://loja.test/pedido/${ORDER_ID}`)

    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: false }))
    res = await get(ORDER_ID, `?transaction_nsu=TX1&slug=s`)
    expect(res.headers.get('location')).toBe(`https://loja.test/pedido/${ORDER_ID}?pagamento=pendente`)
  })

  it('id inválido volta para a Home', async () => {
    const res = await get('xyz')
    expect(new URL(res.headers.get('location')!).pathname).toBe('/')
  })
})

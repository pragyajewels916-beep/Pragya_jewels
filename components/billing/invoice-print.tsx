'use client'

import type { Customer } from '@/lib/db/queries'

interface BillItem {
  id: string
  barcode: string
  item_name: string
  weight: number
  rate: number
  making_charges: number
  gst_rate: number
  line_total: number
}

interface InvoicePrintProps {
  customer: Customer | null
  billDate: string
  dailyGoldRate: number
  items: BillItem[]
  mcValueAdded: {
    weight: number
    rate: number
    total: number
  }
  oldGoldExchange: {
    weight: number
    purity: string
    rate: number
    total: number
  }
  subtotal: number
  billLevelGST: number
  discount: number
  grandTotal: number
  amountPayable: number
  billNo?: string
  saleType: 'gst' | 'non_gst'
  cgst: number
  sgst: number
  igst: number
  paymentMethods?: Array<{
    id: string
    type: 'cash' | 'card' | 'upi' | 'cheque' | 'bank_transfer' | 'other'
    amount: string
    reference: string
  }>
}

export function InvoicePrint({
  customer,
  billDate,
  dailyGoldRate,
  items,
  mcValueAdded,
  oldGoldExchange,
  subtotal,
  billLevelGST,
  discount,
  grandTotal,
  amountPayable,
  billNo,
  saleType,
  cgst,
  sgst,
  igst,
  paymentMethods,
}: InvoicePrintProps) {
  // Format date from YYYY-MM-DD to DD-MM-YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return new Date().toLocaleDateString('en-GB')
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  return (
    <>
      <style jsx global>{`
        .invoice-print-wrapper {
          font-family: 'Playfair Display', serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          display: block;
        }

        @media print {
          /* Portrait for invoice pages */
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          
          body * {
            visibility: hidden;
          }
          .invoice-print-wrapper,
          .invoice-print-wrapper * {
            visibility: visible;
          }
          .invoice-print-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          
          /* Hide purchase bill when printing invoice */
          .purchase-bill-print-wrapper {
            display: none !important;
          }
        }

        .invoice-paper {
          width: 210mm;
          height: 297mm;
          max-height: 297mm;
          background: #fff;
          padding: 8mm;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
          margin: 0 auto;
          page-break-inside: avoid;
        }

        .invoice-paper::before,
        .invoice-paper::after {
          content: "";
          position: absolute;
          left: 18mm;
          right: 18mm;
          height: 1px;
          background: linear-gradient(90deg, transparent, #eee, transparent);
          opacity: 0.25;
        }

        .invoice-paper::before {
          top: 90mm;
          transform: skewX(-0.6deg);
        }

        .invoice-paper::after {
          top: 150mm;
          transform: skewX(0.6deg);
        }

        .invoice-logo {
          font-family: 'Cinzel Decorative', serif;
          color: #d65a5a;
          text-align: center;
          font-size: 48px;
          letter-spacing: 2px;
          margin: 0;
          line-height: 1.2;
        }

        .invoice-logo small {
          display: block;
          font-size: 18px;
          margin-top: 6px;
          color: #d65a5a;
          font-weight: 700;
        }

        .invoice-meta {
          margin-top: 0;
          margin-bottom: 0;
          text-align: center;
        }

        .invoice-meta p {
          margin: 2px 0;
          font-size: 16px;
          color: #222;
          font-weight: 500;
          line-height: 1.3;
        }

        .invoice-meta .address {
          font-variant: small-caps;
          letter-spacing: 0.6px;
        }

        .invoice-meta .contacts {
          color: #d65a5a;
          font-weight: 700;
          font-size: 18px;
        }

        .invoice-info {
          display: flex;
          justify-content: center;
          margin: 18px 0;
          gap: 50px;
        }

        .invoice-info .block {
          min-width: 140px;
        }

        .invoice-info .label {
          font-size: 14px;
          color: #6b6b6b;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .invoice-info .value {
          font-size: 18px;
          color: #222;
          font-weight: 700;
          margin-top: 4px;
          line-height: 1.2;
        }

        .invoice-items {
          margin-top: 24px;
          margin-bottom: 20px;
        }

        .invoice-items table {
          width: 100%;
          border-collapse: collapse;
          font-size: 16px;
          page-break-inside: avoid;
          border: 1px solid #ddd;
        }

        .invoice-items th,
        .invoice-items td {
          padding: 14px 12px;
          line-height: 1.6;
          border: 1px solid #ddd;
        }

        .invoice-items th {
          font-size: 15px;
          background: #f5f5f5;
          color: #222;
          border-bottom: 2px solid #ddd;
          text-align: center;
          font-weight: 700;
        }

        .invoice-items tr {
          page-break-inside: avoid;
        }

        .invoice-items td {
          text-align: center;
        }

        .invoice-items td.item {
          text-align: left;
          padding-left: 12px;
        }

        .invoice-watermark {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(-20deg);
          font-size: 120px;
          font-weight: 700;
          color: rgba(218, 140, 70, 0.12);
          font-family: 'Cinzel Decorative', serif;
          pointer-events: none;
          user-select: none;
          z-index: 0;
        }

        .invoice-totals {
          display: flex;
          justify-content: center;
          margin-top: 30px;
          margin-bottom: 20px;
          z-index: 1;
        }

        .invoice-totals .right {
          text-align: center;
          width: 100%;
        }

        .invoice-totals .label {
          font-size: 16px;
          color: #6b6b6b;
          text-align: center;
          line-height: 1.2;
        }

        .invoice-totals .amount {
          font-size: 32px;
          color: #c0392b;
          font-weight: 800;
          text-align: center;
          line-height: 1.2;
        }

        .invoice-footer {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          z-index: 1;
        }

        .invoice-footer .left {
          text-align: center;
        }

        .invoice-footer p {
          margin: 3px 0;
          font-size: 14px;
          color: #6b6b6b;
          line-height: 1.3;
        }

        .invoice-signature {
          text-align: center;
          font-weight: 700;
        }

        .invoice-small-header {
          font-size: 14px;
          font-weight: 700;
          text-decoration: underline;
          margin-bottom: 2px;
        }

        @media print {
          html,
          body {
            background: #fff;
          }
          .invoice-watermark {
            color: rgba(218, 140, 70, 0.1);
          }
        }
      `}</style>

      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Playfair+Display:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <div className="invoice-print-wrapper">
        <div className="invoice-paper">
          <div style={{ textAlign: 'center', marginBottom: '24px', paddingTop: '20px' }}>
            <div className="invoice-logo">
              PRAGYA JEWELS
              <small>(916 KDM)</small>
            </div>
            
            <div className="invoice-meta" style={{ marginTop: '16px' }}>
              <p className="address">NO: 61/2, VIVYANI ROAD, FRAZER TOWN,</p>
              <p className="address" style={{ fontWeight: 700, letterSpacing: '1px' }}>
                BANGALORE - 560005
              </p>
              <p className="contacts">PH: 080-25807958,&nbsp;&nbsp;&nbsp; MOB: 9845351614</p>
            </div>
          </div>

          <div className="invoice-info">
            <div className="block">
              <div className="label">DATE:-</div>
              <div className="value">{formatDate(billDate)}</div>
            </div>
            <div className="block">
              <div className="label">RATE:-</div>
              <div className="value">{dailyGoldRate.toFixed(2)}</div>
            </div>
            {billNo && (
              <div className="block">
                <div className="label">BILL NO:-</div>
                <div className="value">{billNo}</div>
              </div>
            )}
          </div>

          {customer && (
            <div className="invoice-info" style={{ marginTop: '12px', marginBottom: '12px' }}>
              <div className="block">
                <div className="label">CUSTOMER:-</div>
                <div className="value">{customer.name || 'N/A'}</div>
              </div>
              {customer.phone && (
                <div className="block">
                  <div className="label">PHONE:-</div>
                  <div className="value">{customer.phone}</div>
                </div>
              )}
            </div>
          )}

          <div className="invoice-items">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%', textAlign: 'left', paddingLeft: '12px' }}>ITEM</th>
                  <th style={{ width: '18%' }}>WEIGHT</th>
                  <th style={{ width: '20%' }}>RATE</th>
                  <th style={{ width: '22%' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id || index}>
                    <td className="item">{item.item_name || 'Item'}</td>
                    <td>{item.weight.toFixed(2)}g</td>
                    <td>₹{item.rate.toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>₹{item.line_total.toFixed(2)}</td>
                  </tr>
                ))}
                {mcValueAdded.total > 0 && (
                  <tr style={{ borderTop: '2px solid #ddd' }}>
                    <td className="item" style={{ fontWeight: 700, textDecoration: 'underline' }}>
                      MC / VALUE ADDED
                    </td>
                    <td colSpan={2} style={{ textAlign: 'center' }}>-</td>
                    <td style={{ fontWeight: 700 }}>₹{mcValueAdded.total.toFixed(2)}</td>
                  </tr>
                )}
                {saleType === 'gst' && billLevelGST > 0 && (
                  <>
                    {cgst > 0 && (
                      <tr>
                        <td className="item" colSpan={3} style={{ textAlign: 'center', paddingRight: '12px' }}>
                          CGST (1.5%)
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{cgst.toFixed(2)}</td>
                      </tr>
                    )}
                    {sgst > 0 && (
                      <tr>
                        <td className="item" colSpan={3} style={{ textAlign: 'center', paddingRight: '12px' }}>
                          SGST (1.5%)
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{sgst.toFixed(2)}</td>
                      </tr>
                    )}
                    {igst > 0 && (
                      <tr>
                        <td className="item" colSpan={3} style={{ textAlign: 'center', paddingRight: '12px' }}>
                          IGST
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{igst.toFixed(2)}</td>
                      </tr>
                    )}
                  </>
                )}
                {discount > 0 && (
                  <tr>
                    <td className="item" colSpan={3} style={{ textAlign: 'center', paddingRight: '12px' }}>
                      DISCOUNT
                    </td>
                    <td style={{ color: '#c0392b', fontWeight: 600 }}>-₹{discount.toFixed(2)}</td>
                  </tr>
                )}
                {oldGoldExchange.total > 0 && (
                  <tr>
                    <td className="item" colSpan={3} style={{ textAlign: 'center', paddingRight: '12px' }}>
                      OLD GOLD CREDIT
                    </td>
                    <td style={{ color: '#c0392b', fontWeight: 600 }}>-₹{oldGoldExchange.total.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="invoice-totals">
            <div className="right">
              <div className="label" style={{ fontSize: '18px', marginBottom: '10px' }}>TOTAL</div>
              <div className="amount">₹{amountPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="invoice-watermark">PJ</div>

          {paymentMethods && paymentMethods.length > 0 && (
            <div className="invoice-info" style={{ marginTop: '16px', marginBottom: '10px' }}>
              <div className="block">
                <div className="label">PAYMENT DETAILS:-</div>
                {paymentMethods.map((payment, index) => {
                  const amount = parseFloat(payment.amount) || 0
                  const typeLabel = payment.type === 'cash' ? 'Cash' :
                    payment.type === 'card' ? 'Card' :
                    payment.type === 'upi' ? 'UPI' :
                    payment.type === 'cheque' ? 'Cheque' :
                    payment.type === 'bank_transfer' ? 'Bank Transfer' : 'Other'
                  return (
                    <div key={payment.id || index} style={{ marginTop: index > 0 ? '8px' : '4px' }}>
                      <div className="value">
                        {typeLabel}: ₹{amount.toFixed(2)}
                        {payment.reference && ` (Ref: ${payment.reference})`}
                      </div>
                    </div>
                  )
                })}
                <div className="value" style={{ marginTop: '8px', fontWeight: 'bold' }}>
                  Total: ₹{paymentMethods.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}


          <div className="invoice-footer">
            <div className="left">
              <p className="invoice-small-header">NO EXCHANGE</p>
              <p className="invoice-small-header">NO BREAKAGE GUARANTEE</p>
              <p className="invoice-small-header">RETURN 5% LESS IN CASH</p>
            </div>
            <div className="invoice-signature">
              <div style={{ fontSize: '10px', color: '#6b6b6b', lineHeight: '1.2' }}>FOR</div>
              <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '13px', lineHeight: '1.2' }}>PRAGYA JEWELS</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import type { Bill, Customer } from '@/lib/db/queries'

interface AdvanceBookingPrintProps {
  customer: Customer | null
  bill: Bill | null
  bookingDate: string
  bookingNo?: string
  totalAmount: number
  advanceAmount: number
  dueAmount: number
  deliveryDate: string
  itemDescription?: string
  customerNotes?: string
}

export function AdvanceBookingPrint({
  customer,
  bill,
  bookingDate,
  bookingNo,
  totalAmount,
  advanceAmount,
  dueAmount,
  deliveryDate,
  itemDescription,
  customerNotes
}: AdvanceBookingPrintProps) {
  // Format date from YYYY-MM-DD to DD-MM-YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return new Date().toLocaleDateString('en-GB')
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0.00'
    return `₹${amount.toFixed(2)}`
  }

  return (
    <>
      <style jsx global>{`
        .advance-booking-print-wrapper {
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
          .advance-booking-print-wrapper,
          .advance-booking-print-wrapper * {
            visibility: visible;
          }
          .advance-booking-print-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          
          /* Hide purchase bill when printing advance booking */
          .purchase-bill-print-wrapper {
            display: none !important;
          }
          
          /* Hide layaway when printing advance booking */
          .layaway-print-wrapper {
            display: none !important;
          }
          
          /* Hide sales invoice when printing advance booking */
          .invoice-print-wrapper {
            display: none !important;
          }
        }

        .advance-booking-paper {
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

        .advance-booking-paper::before,
        .advance-booking-paper::after {
          content: "";
          position: absolute;
          left: 18mm;
          right: 18mm;
          height: 1px;
          background: linear-gradient(90deg, transparent, #eee, transparent);
          opacity: 0.25;
        }

        .advance-booking-paper::before {
          top: 90mm;
          transform: skewX(-0.6deg);
        }

        .advance-booking-paper::after {
          top: 150mm;
          transform: skewX(0.6deg);
        }

        .advance-booking-logo {
          font-family: 'Cinzel Decorative', serif;
          color: #d65a5a;
          text-align: center;
          font-size: 48px;
          letter-spacing: 2px;
          margin: 0;
          line-height: 1.2;
        }

        .advance-booking-logo small {
          display: block;
          font-size: 18px;
          margin-top: 6px;
          color: #d65a5a;
          font-weight: 700;
        }

        .advance-booking-meta {
          margin-top: 0;
          margin-bottom: 0;
          text-align: center;
        }

        .advance-booking-meta p {
          margin: 2px 0;
          font-size: 16px;
          color: #222;
          font-weight: 500;
          line-height: 1.3;
        }

        .advance-booking-meta .address {
          font-variant: small-caps;
          letter-spacing: 0.6px;
        }

        .advance-booking-meta .contacts {
          color: #d65a5a;
          font-weight: 700;
          font-size: 18px;
        }

        .advance-booking-info {
          display: flex;
          justify-content: space-between;
          margin: 18px 0;
          gap: 50px;
        }

        .advance-booking-info .left-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .advance-booking-info .right-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: right;
        }

        .advance-booking-info .block {
          min-width: 140px;
        }

        .advance-booking-info .label {
          font-size: 14px;
          color: #6b6b6b;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .advance-booking-info .value {
          font-size: 18px;
          color: #222;
          font-weight: 700;
          margin-top: 4px;
          line-height: 1.2;
        }

        .advance-booking-details {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .advance-booking-details h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #2c3e50;
          font-weight: 700;
        }

        .advance-booking-details p {
          margin: 0;
          line-height: 1.6;
        }

        .advance-booking-summary {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: #f9f9f9;
        }

        .advance-booking-summary .block {
          margin-bottom: 8px;
        }

        .advance-booking-summary .label {
          font-size: 14px;
          color: #6b6b6b;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .advance-booking-summary .value {
          font-size: 18px;
          color: #222;
          font-weight: 700;
          margin-top: 4px;
          line-height: 1.2;
        }

        .advance-booking-summary .block:last-child {
          margin-bottom: 0;
        }

        .advance-booking-watermark {
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

        .advance-booking-footer {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          z-index: 1;
        }

        .advance-booking-footer .left {
          text-align: center;
        }

        .advance-booking-footer p {
          margin: 3px 0;
          font-size: 14px;
          color: #6b6b6b;
          line-height: 1.3;
        }

        .advance-booking-signature {
          text-align: center;
          font-weight: 700;
        }

        .advance-booking-small-header {
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
          .advance-booking-watermark {
            color: rgba(218, 140, 70, 0.1);
          }
        }
      `}</style>

      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Playfair+Display:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <div className="advance-booking-print-wrapper">
        <div className="advance-booking-paper">
          <div style={{ textAlign: 'center', marginBottom: '24px', paddingTop: '20px' }}>
            <div className="advance-booking-logo">
              PRAGYA JEWELS
              <small>(916 KDM)</small>
            </div>
            
            <div className="advance-booking-meta" style={{ marginTop: '16px' }}>
              <p className="address">NO: 61/2, VIVYANI ROAD, FRAZER TOWN,</p>
              <p className="address" style={{ fontWeight: 700, letterSpacing: '1px' }}>
                BANGALORE - 560005
              </p>
              <p className="contacts">PH: 080-25807958,&nbsp;&nbsp;&nbsp; MOB: 9845351614</p>
            </div>
          </div>

          <div className="advance-booking-info">
            <div className="left-section">
              {bookingNo && (
                <div className="block">
                  <div className="label">BOOKING NO:-</div>
                  <div className="value">{bookingNo}</div>
                </div>
              )}
              {customer && (
                <>
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
                </>
              )}
            </div>
            <div className="right-section">
              <div className="block">
                <div className="label">DATE:-</div>
                <div className="value">{formatDate(bookingDate)}</div>
              </div>
              <div className="block">
                <div className="label">DELIVERY DATE:-</div>
                <div className="value">{formatDate(deliveryDate)}</div>
              </div>
              <div className="block">
                <div className="label">TOTAL AMOUNT:-</div>
                <div className="value">{formatCurrency(totalAmount)}</div>
              </div>
              <div className="block">
                <div className="label">ADVANCE PAID:-</div>
                <div className="value">{formatCurrency(advanceAmount)}</div>
              </div>
              <div className="block">
                <div className="label">AMOUNT DUE:-</div>
                <div className="value">{formatCurrency(dueAmount)}</div>
              </div>
            </div>
          </div>

          {(itemDescription || customerNotes) && (
            <div className="advance-booking-details">
              {itemDescription && (
                <>
                  <h3>ITEM DESCRIPTION</h3>
                  <p>{itemDescription}</p>
                </>
              )}
              {customerNotes && (
                <>
                  <h3 style={{ marginTop: itemDescription ? '15px' : '0' }}>CUSTOMER NOTES</h3>
                  <p>{customerNotes}</p>
                </>
              )}
            </div>
          )}

          <div className="advance-booking-watermark">PJ</div>

          <div className="advance-booking-footer">
            <div className="left">
              <p className="advance-booking-small-header">NO EXCHANGE</p>
              <p className="advance-booking-small-header">NO BREAKAGE GUARANTEE</p>
              <p className="advance-booking-small-header">RETURN 5% LESS IN CASH</p>
            </div>
            <div className="advance-booking-signature" style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '10px', color: '#6b6b6b', lineHeight: '1.2' }}>FOR</div>
              <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '13px', lineHeight: '1.2' }}>PRAGYA JEWELS</div>
              <div style={{ marginTop: '40px', fontSize: '14px', fontWeight: 600 }}>Authorized Signature</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
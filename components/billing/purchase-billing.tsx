'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PurchaseItem {
  id: string
  hsn_code: string
  code: string
  weight: number
  purity: string
  rate: number
  amount: number
}

interface Vendor {
  id: string
  name: string
  phone: string
}

export function PurchaseBilling() {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [newItem, setNewItem] = useState({
    hsn_code: '',
    code: '',
    weight: 0,
    purity: '',
    rate: 0,
  })
  const [particulars, setParticulars] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [saleBillId, setSaleBillId] = useState('')
  const [remark, setRemark] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [billNo, setBillNo] = useState('') // Will be auto-generated
  const [staffId, setStaffId] = useState('') // Get from session
  const [customerId, setCustomerId] = useState('') // Store when vendor selected

  const mockVendors: Vendor[] = [
    { id: '1', name: 'Old Gold Exchange Co.', phone: '9876543210' },
    { id: '2', name: 'Premium Old Jewelry', phone: '9876543211' },
    { id: '3', name: 'Gold Scrap Dealer', phone: '9876543212' },
  ]

  const handleAddItem = () => {
    if (newItem.weight && newItem.rate) {
      const amount = newItem.weight * newItem.rate
      setItems([
        ...items,
        {
          id: Date.now().toString(),
          hsn_code: newItem.hsn_code || '',
          code: newItem.code || '',
          weight: newItem.weight,
          purity: newItem.purity,
          rate: newItem.rate,
          amount,
        },
      ])
      setNewItem({ hsn_code: '', code: '', weight: 0, purity: '', rate: 0 })
    }
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const cgst = totalAmount * 0.09
  const sgst = totalAmount * 0.09
  const grandTotal = totalAmount + cgst + sgst

  // Get staff ID from session
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setStaffId(userData.id || 'staff-001') // Mock staff ID
    }
  }, [])

  // Set customer_id when vendor is selected
  useEffect(() => {
    if (vendor) {
      setCustomerId(vendor.id)
    }
  }, [vendor])

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Purchase Billing (Pink Slip)</h1>
        <p className="text-muted-foreground">Record old gold purchases from customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vendor Section */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground">Vendor Information</h2>
            {!vendor ? (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Search Vendor</label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Search by name or phone..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="flex-1"
                  />
                  <Button className="bg-primary hover:bg-primary/90 text-white">Add New</Button>
                </div>
                {vendorSearch && (
                  <div className="space-y-2">
                    {mockVendors
                      .filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                      .map(v => (
                        <div
                          key={v.id}
                          className="p-3 border border-border rounded-lg cursor-pointer hover:bg-secondary"
                          onClick={() => setVendor(v)}
                        >
                          <p className="font-medium text-foreground">{v.name}</p>
                          <p className="text-sm text-muted-foreground">{v.phone}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-pink-50 rounded-lg flex justify-between items-center border-2 border-pink-200">
                <div>
                  <p className="font-bold text-foreground">{vendor.name}</p>
                  <p className="text-sm text-muted-foreground">{vendor.phone}</p>
                </div>
                <Button variant="outline" onClick={() => setVendor(null)} className="text-destructive">Change</Button>
              </div>
            )}
          </Card>

          {/* Purchase Information */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground">Purchase Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Purchase Date</label>
                <Input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
              {billNo && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Bill Number</label>
                  <Input value={billNo} disabled className="bg-muted" />
                </div>
              )}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground mb-2 block">Particulars / Description</label>
                <Input
                  placeholder="Enter particulars or description"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground mb-2 block">Sale Bill ID (optional - link to white bill)</label>
                <Input
                  placeholder="Enter sale bill ID if linked"
                  value={saleBillId}
                  onChange={(e) => setSaleBillId(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Items Section */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground">Add Old Gold Items</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                placeholder="HSN Code"
                value={newItem.hsn_code}
                onChange={(e) => setNewItem({ ...newItem, hsn_code: e.target.value })}
              />
              <Input
                placeholder="Item Code"
                value={newItem.code}
                onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Weight (grams)"
                step="0.01"
                value={newItem.weight || ''}
                onChange={(e) => setNewItem({ ...newItem, weight: parseFloat(e.target.value) || 0 })}
              />
              <Input
                placeholder="Purity"
                value={newItem.purity}
                onChange={(e) => setNewItem({ ...newItem, purity: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Rate per gram"
                step="0.01"
                value={newItem.rate || ''}
                onChange={(e) => setNewItem({ ...newItem, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <Button onClick={handleAddItem} className="w-full bg-primary hover:bg-primary/90 text-white">
              Add Item to Slip
            </Button>
          </Card>

          {/* Items Table */}
          {items.length > 0 && (
            <Card className="p-6 overflow-x-auto">
              <h2 className="text-xl font-bold mb-4 text-foreground">Purchase Items</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-3 font-semibold text-foreground">HSN</th>
                    <th className="text-left py-3 font-semibold text-foreground">Code</th>
                    <th className="text-left py-3 font-semibold text-foreground">Weight</th>
                    <th className="text-left py-3 font-semibold text-foreground">Purity</th>
                    <th className="text-left py-3 font-semibold text-foreground">Rate</th>
                    <th className="text-left py-3 font-semibold text-foreground">Amount</th>
                    <th className="text-center py-3 font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-border hover:bg-secondary">
                      <td className="py-3 text-foreground">{item.hsn_code}</td>
                      <td className="py-3 text-foreground">{item.code}</td>
                      <td className="py-3 text-foreground">{item.weight}g</td>
                      <td className="py-3 text-foreground">{item.purity}</td>
                      <td className="py-3 text-foreground">₹{item.rate.toFixed(2)}</td>
                      <td className="py-3 font-bold text-primary">₹{item.amount.toFixed(2)}</td>
                      <td className="py-3 text-center">
                        <button onClick={() => handleRemoveItem(item.id)} className="text-destructive">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Information */}
          <Card className="p-6">
            <h3 className="font-bold text-foreground mb-3">Payment Information</h3>
            <div className="space-y-3">
              <Input
                placeholder="Payment Mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              />
              <Input
                placeholder="Payment Reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </Card>

          {/* Pink Slip Summary */}
          <Card className="p-6 bg-pink-50 border-2 border-pink-200">
            <h3 className="font-bold text-foreground mb-4">Pink Slip Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-foreground">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST (9%):</span>
                <span className="text-foreground">₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST (9%):</span>
                <span className="text-foreground">₹{sgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="text-foreground font-medium">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-pink-300 pt-3 flex justify-between">
                <span className="font-bold text-foreground">Grand Total:</span>
                <span className="font-bold text-primary text-lg">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Remarks */}
          <Card className="p-6">
            <h3 className="font-bold text-foreground mb-3">Remarks</h3>
            <Input
              placeholder="Enter any remarks"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-lg shadow-lg"
              onClick={() => {
                // Trigger print after a short delay
                setTimeout(() => {
                  window.print()
                }, 100)
              }}
            >
              💾🖨️ Save and Print Bill
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

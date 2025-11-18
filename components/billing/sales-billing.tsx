'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/lib/db/queries'
import { createBill, createBillItems } from '@/lib/db/queries'
import { toast } from '@/components/ui/use-toast'
import { InvoicePrint } from './invoice-print'

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

export function SalesBilling() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerMatches, setCustomerMatches] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })
  
  const [items, setItems] = useState<BillItem[]>([])
  const [newItem, setNewItem] = useState({ 
    barcode: '', 
    item_name: '', 
    weight: 0, 
    weightInput: '', // Raw string input
    rate: 0, 
    making_charges: 0,
    makingChargesInput: '', // Raw string input
  })
  const [isLoadingItem, setIsLoadingItem] = useState(false)
  const [dailyGoldRate, setDailyGoldRate] = useState(0) // Daily gold rate per gram
  const [dailyGoldRateInput, setDailyGoldRateInput] = useState('') // Raw string input for daily gold rate
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [discount, setDiscount] = useState(0)
  const [discountInput, setDiscountInput] = useState('') // Raw string input for discount
  const [saleType, setSaleType] = useState<'gst' | 'non_gst'>('gst')
  const [gstInputType, setGstInputType] = useState<'amount' | 'percentage'>('percentage') // For bill-level GST
  const [cgst, setCgst] = useState(0) // Separate CGST input (amount or percentage based on gstInputType)
  const [cgstInput, setCgstInput] = useState('') // Raw string input for CGST
  const [sgst, setSgst] = useState(0) // Separate SGST input (amount or percentage based on gstInputType)
  const [sgstInput, setSgstInput] = useState('') // Raw string input for SGST
  const [igst, setIgst] = useState(0) // IGST input (amount or percentage based on gstInputType)
  const [igstInput, setIgstInput] = useState('') // Raw string input for IGST
  const [mcValueAdded, setMcValueAdded] = useState({
    weight: 0,
    weightInput: '', // Raw string input
    rate: 0,
    rateInput: '', // Raw string input
    total: 0,
  })
  const [oldGoldExchange, setOldGoldExchange] = useState({
    weight: 0,
    weightInput: '', // Raw string input for weight
    purity: '',
    rate: 0,
    rateInput: '', // Raw string input for rate
    total: 0,
    hsn_code: '7113', // Default HSN code for old gold
    particulars: '', // Description/particulars
  })
  const [purchaseBillId, setPurchaseBillId] = useState<string>('') // Store purchase bill ID when created
  const [remarks, setRemarks] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [billStatus, setBillStatus] = useState<'draft' | 'finalized' | 'cancelled'>('draft')
  const [billNo, setBillNo] = useState('')
  const [nongstAuthId, setNongstAuthId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('staff')
  const [canAuthorizeNonGst, setCanAuthorizeNonGst] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)

  // Get user info from session and fetch daily gold rate
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setStaffId(userData.id || 'staff-001')
      setUserRole(userData.role || 'staff')
      setCanAuthorizeNonGst(userData.can_authorize_nongst || false)
      
      // Staff can ONLY use GST, never Non-GST - enforce this
      if (userData.role === 'staff') {
        setSaleType('gst')
        setNongstAuthId('') // Clear any non-GST auth ID if staff somehow had it
      }
    }

    // Fetch latest daily gold rate from gold_rates table
    const fetchDailyGoldRate = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('gold_rates')
          .select('*')
          .order('effective_date', { ascending: false })
          .limit(1)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching gold rate:', error)
        } else if (data) {
          const rate = parseFloat(data.rate_per_gram) || 0
          setDailyGoldRate(rate)
          setDailyGoldRateInput(rate.toString())
        }
      } catch (error) {
        console.error('Error fetching daily gold rate:', error)
      }
    }

    fetchDailyGoldRate()
  }, [])

  // Live customer search with debouncing
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerMatches([])
      setShowCustomerDropdown(false)
      return
    }

    const searchCustomers = async () => {
      setIsSearching(true)
      try {
        const supabase = createClient()
        const searchTerm = customerSearch.trim()
        
        // Search by phone (partial match) or name
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .or(`phone.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
          .limit(10)

        if (error) {
          console.error('Search error:', error)
          setCustomerMatches([])
        } else {
          setCustomerMatches(data || [])
          setShowCustomerDropdown(true)
        }
      } catch (error) {
        console.error('Error searching customers:', error)
        setCustomerMatches([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchCustomers, 300)
    return () => clearTimeout(debounceTimer)
  }, [customerSearch])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false)
      }
    }

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCustomerDropdown])

  // Auto-fetch item details when barcode is scanned/entered
  useEffect(() => {
    const barcodeValue = newItem.barcode.trim()
    if (!barcodeValue) {
      setIsLoadingItem(false)
      return
    }

    // Debounce the search to avoid too many API calls
    const searchItem = async () => {
      setIsLoadingItem(true)
      try {
        const supabase = createClient()
        
        // Check if Supabase is properly configured
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error('Supabase environment variables not configured')
          setIsLoadingItem(false)
          return
        }

        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('barcode', barcodeValue)
          .single()

        if (error) {
          // Item not found - that's okay, user can enter manually
        if (error.code === 'PGRST116') {
          console.log('Item not found for barcode:', barcodeValue)
        } else if (error.message?.includes('406') || error.code === 'PGRST301') {
          console.error('406 Error - Check RLS policies or API key:', error)
          console.error('Full error details:', JSON.stringify(error, null, 2))
        } else {
          console.error('Error fetching item:', error)
          console.error('Error code:', error.code, 'Error message:', error.message)
        }
          setIsLoadingItem(false)
          return
        }

        if (data) {
          console.log('Item found:', data)
          // Auto-populate item fields from database
          // Note: rate will be calculated from daily gold rate, not from item's price_per_gram
          setNewItem(prev => ({
            ...prev,
            barcode: data.barcode || prev.barcode,
            item_name: data.item_name || '',
            weight: data.weight || 0,
            weightInput: data.weight?.toString() || '',
            rate: dailyGoldRate || 0, // Use daily gold rate
            making_charges: data.making_charges || 0,
            makingChargesInput: data.making_charges?.toString() || '',
          }))
        }
      } catch (error: any) {
        console.error('Error searching for item:', error)
        if (error.status === 406 || error.statusCode === 406) {
          console.error('406 Not Acceptable - This usually means:')
          console.error('1. RLS policies are blocking the request')
          console.error('2. Missing or incorrect API key in headers')
          console.error('3. Check Supabase dashboard for RLS policies on items table')
        }
      } finally {
        setIsLoadingItem(false)
      }
    }

    // Wait 300ms after user stops typing before searching (reduced from 500ms)
    const debounceTimer = setTimeout(searchItem, 300)
    return () => clearTimeout(debounceTimer)
  }, [newItem.barcode])

  // Search barcode function
  const handleSearchBarcode = async () => {
    const barcodeValue = newItem.barcode.trim()
    if (!barcodeValue) {
      toast({
        title: 'Barcode Required',
        description: 'Please enter a barcode to search',
        variant: 'destructive',
      })
      return
    }

    setIsLoadingItem(true)
    try {
      const supabase = createClient()
      
      // Check if Supabase is properly configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        toast({
          title: 'Configuration Error',
          description: 'Supabase is not configured. Please check your .env.local file.',
          variant: 'destructive',
        })
        setIsLoadingItem(false)
        return
      }

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('barcode', barcodeValue)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Item not found for barcode:', barcodeValue)
          toast({
            title: 'Item Not Found',
            description: `Item not found for barcode: "${barcodeValue}". Please enter details manually or check if the item exists in inventory.`,
            variant: 'destructive',
          })
        } else if (error.message?.includes('406') || error.code === 'PGRST301') {
          console.error('406 Not Acceptable Error:', error)
          console.error('Full error:', JSON.stringify(error, null, 2))
          toast({
            title: 'Access Denied (406)',
            description: 'RLS policies may be blocking access. Check Supabase dashboard → Authentication → Policies',
            variant: 'destructive',
          })
        } else {
          console.error('Error fetching item:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
          toast({
            title: 'Error',
            description: `Error searching for item: ${error.message || 'Unknown error'}. Check console for details.`,
            variant: 'destructive',
          })
        }
        setIsLoadingItem(false)
        return
      }

      if (data) {
        console.log('Item found:', data)
        // Auto-populate item fields from database
        // Note: rate will be calculated from daily gold rate, not from item's price_per_gram
        setNewItem(prev => ({
          ...prev,
          barcode: data.barcode || prev.barcode,
          item_name: data.item_name || '',
          weight: data.weight || 0,
          weightInput: data.weight?.toString() || '',
          rate: dailyGoldRate || 0, // Use daily gold rate
          making_charges: data.making_charges || 0,
          makingChargesInput: data.making_charges?.toString() || '',
        }))
        toast({
          title: 'Item Found',
          description: `Successfully loaded: ${data.item_name || 'Unnamed item'}`,
        })
      }
    } catch (error: any) {
      console.error('Error searching for item:', error)
      if (error.message?.includes('406') || error.code === 'PGRST301') {
        toast({
          title: 'Access Denied',
          description: 'Check RLS policies in Supabase dashboard',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: 'Error searching for item. Please check console.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoadingItem(false)
    }
  }

  const handleSelectCustomer = (selectedCustomer: Customer) => {
    setCustomer(selectedCustomer)
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setShowAddCustomerForm(false)
  }

  const handleAddNewCustomer = async () => {
    if (!newCustomerData.name || !newCustomerData.phone) {
      toast({
        title: 'Required Fields',
        description: 'Name and Phone are required',
        variant: 'destructive',
      })
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: newCustomerData.name,
          phone: newCustomerData.phone,
          email: newCustomerData.email || null,
          address: newCustomerData.address || null,
          notes: newCustomerData.notes || null,
        })
        .select()
        .single()

      if (error) throw error
      
      if (data) {
        setCustomer(data as Customer)
        setCustomerSearch('')
        setShowAddCustomerForm(false)
        setShowCustomerDropdown(false)
        setNewCustomerData({ name: '', phone: '', email: '', address: '', notes: '' })
        toast({
          title: 'Customer Added',
          description: 'Customer has been successfully added',
        })
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      toast({
        title: 'Error',
        description: 'Failed to create customer. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const calculateLineTotal = (weight: number, goldRate: number, making: number) => {
    // Base amount = (weight × daily gold rate) + making charges
    // GST will be applied at bill level, not item level
    return weight * goldRate + making
  }

  const handleAddItem = () => {
    if (newItem.item_name && newItem.weight) {
      // Use daily gold rate for calculation
      const goldRate = dailyGoldRate || newItem.rate || 0
      if (!goldRate) {
        toast({
          title: 'Gold Rate Required',
          description: 'Please set the daily gold rate first',
          variant: 'destructive',
        })
        return
      }
      const weight = parseFloat(newItem.weightInput) || 0
      const makingCharges = parseFloat(newItem.makingChargesInput) || 0
      const lineTotal = calculateLineTotal(weight, goldRate, makingCharges)
      setItems([
        ...items,
        {
          id: Date.now().toString(),
          barcode: newItem.barcode || '',
          item_name: newItem.item_name,
          weight: weight,
          rate: goldRate, // Store the gold rate used
          making_charges: makingCharges,
          gst_rate: 0, // No item-level GST, GST is applied at bill level
          line_total: lineTotal,
        },
      ])
      setNewItem({ barcode: '', item_name: '', weight: 0, weightInput: '', rate: 0, making_charges: 0, makingChargesInput: '' })
    }
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  // Calculate MC/Value Added total
  useEffect(() => {
    const weight = parseFloat(mcValueAdded.weightInput) || 0
    const rate = parseFloat(mcValueAdded.rateInput) || 0
    const mcTotal = weight * rate
    setMcValueAdded(prev => ({ ...prev, weight, rate, total: mcTotal }))
  }, [mcValueAdded.weightInput, mcValueAdded.rateInput])

  // Calculate Old Gold Exchange total
  useEffect(() => {
    const weight = parseFloat(oldGoldExchange.weightInput) || 0
    const rate = parseFloat(oldGoldExchange.rateInput) || 0
    const oldGoldTotal = weight * rate
    setOldGoldExchange(prev => ({ ...prev, weight, rate, total: oldGoldTotal }))
  }, [oldGoldExchange.weightInput, oldGoldExchange.rateInput])

  // Safety check: Staff can NEVER use Non-GST, force it to GST
  useEffect(() => {
    if (userRole === 'staff' && saleType === 'non_gst') {
      setSaleType('gst')
      setNongstAuthId('')
    }
  }, [userRole, saleType])

  // Calculate totals
  // Subtotal = sum of line_totals (base amounts without GST, GST applied at bill level)
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
  // Bill-level GST from CGST/SGST/IGST inputs
  let billLevelGST = 0
  if (saleType === 'gst') {
    if (gstInputType === 'percentage') {
      // Calculate GST as percentage of subtotal
      billLevelGST = (subtotal * (cgst / 100)) + (subtotal * (sgst / 100)) + (subtotal * (igst / 100))
    } else {
      // GST is entered as direct amounts
      billLevelGST = cgst + sgst + igst
    }
  }
  // Grand Total = Subtotal + Bill-level GST (CGST/SGST/IGST) + MC/Value Added - Discount - Old Gold Credit
  const grandTotal = subtotal + billLevelGST + mcValueAdded.total - discount - oldGoldExchange.total
  const amountPayable = grandTotal // Amount customer needs to pay after old gold credit

  // Function to generate bill number
  const generateBillNumber = async () => {
    try {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]
      
      // Get the latest bill number for today
      const { data: latestBill } = await supabase
        .from('bills')
        .select('bill_no')
        .like('bill_no', `SALE-${today.replace(/-/g, '')}-%`)
        .order('bill_no', { ascending: false })
        .limit(1)
        .single()

      let billNumber = ''
      if (latestBill?.bill_no) {
        // Extract the sequence number and increment
        const parts = latestBill.bill_no.split('-')
        const lastPart = parts[parts.length - 1]
        const sequence = parseInt(lastPart) + 1
        billNumber = `SALE-${today.replace(/-/g, '')}-${String(sequence).padStart(4, '0')}`
      } else {
        // First bill of the day
        billNumber = `SALE-${today.replace(/-/g, '')}-0001`
      }
      
      return billNumber
    } catch (error) {
      // Fallback to timestamp-based number
      return `SALE-${Date.now()}`
    }
  }

  // Function to save bill to database
  const handleSaveBill = async () => {
    if (!customer) {
      toast({
        title: 'Customer Required',
        description: 'Please select a customer before saving the bill',
        variant: 'destructive',
      })
      return false
    }
    if (items.length === 0) {
      toast({
        title: 'Items Required',
        description: 'Please add at least one item to the bill',
        variant: 'destructive',
      })
      return false
    }

    try {
      // Generate bill number if not set
      let finalBillNo = billNo
      if (!finalBillNo) {
        finalBillNo = await generateBillNumber()
        setBillNo(finalBillNo)
      }

      // Prepare bill data
      const billData = {
        bill_date: billDate,
        customer_id: customer.id,
        staff_id: staffId || undefined,
        nongst_auth_id: saleType === 'non_gst' ? (nongstAuthId || undefined) : undefined,
        sale_type: saleType,
        subtotal: subtotal,
        gst_amount: billLevelGST,
        cgst: saleType === 'gst' ? (gstInputType === 'percentage' ? subtotal * (cgst / 100) : cgst) : undefined,
        sgst: saleType === 'gst' ? (gstInputType === 'percentage' ? subtotal * (sgst / 100) : sgst) : undefined,
        igst: saleType === 'gst' ? (gstInputType === 'percentage' ? subtotal * (igst / 100) : igst) : undefined,
        discount: discount || undefined,
        grand_total: grandTotal,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference || undefined,
        bill_status: 'finalized' as const,
        remarks: remarks || undefined,
      }

      // Create bill
      const createdBill = await createBill(billData)
      
      // Update bill number if it was generated
      if (createdBill.bill_no && createdBill.bill_no !== finalBillNo) {
        setBillNo(createdBill.bill_no)
        finalBillNo = createdBill.bill_no
      }

      // Prepare bill items
      const billItemsData = items.map(item => ({
        barcode: item.barcode && item.barcode.trim() ? item.barcode : undefined,
        item_name: item.item_name,
        weight: item.weight,
        rate: item.rate,
        making_charges: item.making_charges || 0,
        gst_rate: 0, // GST is at bill level
        line_total: item.line_total,
      }))

      // Add MC/Value Added as an item if present
      if (mcValueAdded.total > 0) {
        billItemsData.push({
          barcode: undefined,
          item_name: 'MC / VALUE ADDED',
          weight: mcValueAdded.weight,
          rate: mcValueAdded.rate,
          making_charges: 0,
          gst_rate: 0,
          line_total: mcValueAdded.total,
        })
      }

      // Save bill items
      await createBillItems(createdBill.id, billItemsData)

      // Handle old gold exchange (pink slip) if present
      // This is a credit/deduction on the sales bill, NOT a separate purchase transaction
      if (oldGoldExchange.total > 0) {
        try {
          const supabase = createClient()
          
          // Save to old_gold_exchanges table
          // Build notes field with all relevant information
          const oldGoldNotes = [
            oldGoldExchange.particulars && `Description: ${oldGoldExchange.particulars}`,
            oldGoldExchange.hsn_code && `HSN Code: ${oldGoldExchange.hsn_code}`,
          ].filter(Boolean).join(' | ') || null

          const { error: oldGoldError } = await supabase
            .from('old_gold_exchanges')
            .insert({
              bill_id: createdBill.id,
              weight: oldGoldExchange.weight || parseFloat(oldGoldExchange.weightInput) || 0,
              purity: oldGoldExchange.purity || null,
              rate_per_gram: oldGoldExchange.rate || parseFloat(oldGoldExchange.rateInput) || 0,
              total_value: oldGoldExchange.total,
              notes: oldGoldNotes,
            })

          if (oldGoldError) {
            console.error('Error saving to old_gold_exchanges:', oldGoldError)
            toast({
              title: 'Warning',
              description: 'Bill saved but old gold exchange data may not have been saved correctly',
              variant: 'destructive',
            })
          }
        } catch (error) {
          console.error('Error handling old gold exchange:', error)
          toast({
            title: 'Warning',
            description: 'Bill saved but old gold exchange data may not have been saved correctly',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: 'Bill Saved Successfully',
        description: `Bill ${finalBillNo} has been saved and finalized`,
      })

      return true
    } catch (error: any) {
      console.error('Error saving bill:', error)
      toast({
        title: 'Error Saving Bill',
        description: error.message || 'Failed to save bill. Please try again.',
        variant: 'destructive',
      })
      return false
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Professional Header */}
        <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Sales Bill</h1>
              <p className="text-slate-600 dark:text-slate-400">Create and manage customer sales bills</p>
            </div>
            <div className="flex gap-4 items-center">
              {/* Daily Gold Rate Display/Input (Admin Only) */}
              {userRole === 'admin' && (
                <Card className="p-4 border-2 border-primary/20">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1 block">Daily Gold Rate (₹/gram)</label>
                    <Input
                      type="text"
                      placeholder="Enter gold rate"
                      value={dailyGoldRateInput}
                      onChange={async (e) => {
                        const val = e.target.value
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setDailyGoldRateInput(val)
                          const rate = val === '' ? 0 : parseFloat(val)
                          if (isNaN(rate) && val !== '') return
                          
                          setDailyGoldRate(rate)
                          
                          // Only save to database if rate is valid and not empty
                          if (rate > 0 || val === '0') {
                            // Create new gold rate entry for today
                            try {
                              const supabase = createClient()
                              const today = new Date().toISOString().split('T')[0]
                              
                              // Check if rate already exists for today
                              const { data: existingRate } = await supabase
                                .from('gold_rates')
                                .select('*')
                                .eq('effective_date', today)
                                .single()

                              let error
                              if (existingRate) {
                                // Update existing rate for today
                                const { error: updateError } = await supabase
                                  .from('gold_rates')
                                  .update({
                                    rate_per_gram: rate,
                                  })
                                  .eq('id', existingRate.id)
                                error = updateError
                              } else {
                                // Insert new rate for today
                                const { error: insertError } = await supabase
                                  .from('gold_rates')
                                  .insert({
                                    rate_per_gram: rate,
                                    effective_date: today,
                                  })
                                error = insertError
                              }

                              if (error) {
                                console.error('Error saving gold rate:', error)
                                toast({
                                  title: 'Error',
                                  description: 'Failed to save gold rate. Please try again.',
                                  variant: 'destructive',
                                })
                              } else if (rate > 0) {
                                toast({
                                  title: 'Gold Rate Updated',
                                  description: `Daily gold rate set to ₹${rate.toFixed(2)}/gram for ${today}`,
                                })
                              }
                            } catch (error) {
                              console.error('Error saving gold rate:', error)
                              toast({
                                title: 'Error',
                                description: 'Failed to save gold rate. Please try again.',
                                variant: 'destructive',
                              })
                            }
                          }
                        }
                      }}
                      className="h-10 w-40"
                    />
                  </div>
                </Card>
              )}
              {userRole === 'staff' && dailyGoldRate > 0 && (
                <Card className="p-4 border-2 border-primary/20">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Daily Gold Rate</p>
                    <p className="text-2xl font-bold text-primary">₹{dailyGoldRate.toFixed(2)}/gram</p>
                  </div>
                </Card>
              )}
              {billNo && (
                <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Bill Number</p>
                  <p className="text-xl font-bold text-primary">{billNo}</p>
                </div>
              )}
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
            {/* Customer Section - Professional Design */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-primary text-xl">👤</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Customer Information</h2>
                </div>

            {!customer ? (
                  <div className="space-y-4 customer-search-container">
                    {/* Search Input */}
                    <div className="relative">
                  <Input
                        type="text"
                        placeholder="Type phone number or name to search..."
                    value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value)
                          setShowCustomerDropdown(true)
                        }}
                        onFocus={() => customerSearch && setShowCustomerDropdown(true)}
                        className="w-full h-12 text-lg pr-10"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                      )}
                      
                      {/* Customer Dropdown */}
                      {showCustomerDropdown && customerSearch && (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                          {customerMatches.length > 0 ? (
                            <>
                              {customerMatches.map((match) => (
                                <div
                                  key={match.id}
                                  onClick={() => handleSelectCustomer(match)}
                                  className="p-4 hover:bg-primary/5 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-foreground">{match.name || 'No Name'}</p>
                                      <p className="text-sm text-muted-foreground">📞 {match.phone}</p>
                                      {match.email && (
                                        <p className="text-xs text-muted-foreground mt-1">✉️ {match.email}</p>
                                      )}
                                    </div>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                      {match.customer_code}
                                    </span>
                                  </div>
                        </div>
                      ))}
                              <div
                                onClick={() => {
                                  setShowAddCustomerForm(true)
                                  setShowCustomerDropdown(false)
                                }}
                                className="p-4 bg-primary/5 hover:bg-primary/10 cursor-pointer border-t-2 border-primary/20 transition-colors"
                              >
                                <p className="font-medium text-primary text-center">
                                  + Add New Customer
                                </p>
                </div>
                            </>
                          ) : customerSearch && !isSearching ? (
                            <div
                              onClick={() => {
                                setShowAddCustomerForm(true)
                                setShowCustomerDropdown(false)
                              }}
                              className="p-6 text-center cursor-pointer hover:bg-primary/5 transition-colors"
                            >
                              <p className="text-muted-foreground mb-2">No customer found</p>
                              <p className="text-primary font-medium">+ Add New Customer</p>
                            </div>
                          ) : null}
                  </div>
                      )}
                    </div>

                    {/* Add Customer Form */}
                    {showAddCustomerForm && (
                      <Card className="p-6 bg-slate-50 dark:bg-slate-900 border-2 border-primary/20">
                        <h3 className="font-bold text-foreground mb-4">Add New Customer</h3>
                        <div className="space-y-3">
                          <Input
                            placeholder="Full Name *"
                            value={newCustomerData.name}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                            className="bg-white dark:bg-slate-800"
                          />
                          <Input
                            placeholder="Phone Number *"
                            value={newCustomerData.phone}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                            className="bg-white dark:bg-slate-800"
                          />
                          <Input
                            placeholder="Email (optional)"
                            type="email"
                            value={newCustomerData.email}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                            className="bg-white dark:bg-slate-800"
                          />
                          <Input
                            placeholder="Address (optional)"
                            value={newCustomerData.address}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                            className="bg-white dark:bg-slate-800"
                          />
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={handleAddNewCustomer}
                              className="flex-1 bg-primary hover:bg-primary/90 text-white"
                            >
                              Add Customer
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowAddCustomerForm(false)
                                setNewCustomerData({ name: '', phone: '', email: '', address: '', notes: '' })
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </Card>
                )}
              </div>
            ) : (
                  <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-xl font-bold text-foreground">{customer.name || 'No Name'}</p>
                          <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                            {customer.customer_code}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {customer.phone && <p>📞 {customer.phone}</p>}
                          {customer.email && <p>✉️ {customer.email}</p>}
                          {customer.address && <p>📍 {customer.address}</p>}
                        </div>
                </div>
                <Button
                  variant="outline"
                        onClick={() => {
                          setCustomer(null)
                          setCustomerSearch('')
                        }}
                        className="text-destructive border-destructive hover:bg-destructive/10"
                >
                  Change
                </Button>
                    </div>
              </div>
            )}
              </div>
          </Card>

            {/* Bill Information */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-blue-500 text-xl">📋</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Bill Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Bill Date</label>
            <Input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Sale Type</label>
                    {userRole === 'admin' ? (
                      <select
              value={saleType}
                        onChange={(e) => setSaleType(e.target.value as 'gst' | 'non_gst')}
                        className="w-full h-11 px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      >
                        <option value="gst">GST</option>
                        <option value="non_gst">Non-GST</option>
                      </select>
                    ) : (
                      <div className="w-full h-11 px-3 py-2 border border-border rounded-lg bg-muted text-foreground flex items-center">
                        GST (Staff can only create GST bills)
                      </div>
                    )}
                    {/* Force staff to always use GST - safety check */}
                    {userRole === 'staff' && saleType !== 'gst' && (
                      <div className="text-xs text-destructive mt-1">
                        Staff cannot create Non-GST bills. Automatically set to GST.
                      </div>
                    )}
                  </div>
                  {saleType === 'non_gst' && userRole === 'admin' && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-semibold text-foreground mb-2 block">Non-GST Auth ID</label>
                      <Input
                        placeholder="Enter authorization ID"
                        value={nongstAuthId}
                        onChange={(e) => setNongstAuthId(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  )}
                  {saleType === 'gst' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="text-sm font-semibold text-foreground mb-2 block">GST Input Type</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gstInputType"
                              value="percentage"
                              checked={gstInputType === 'percentage'}
                              onChange={(e) => {
                                setGstInputType('percentage')
                                setCgst(0)
                                setSgst(0)
                                setIgst(0)
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Percentage (%)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gstInputType"
                              value="amount"
                              checked={gstInputType === 'amount'}
                              onChange={(e) => {
                                setGstInputType('amount')
                                setCgst(0)
                                setSgst(0)
                                setIgst(0)
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Amount (₹)</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-2 block">
                          CGST {gstInputType === 'percentage' ? '(%)' : '(₹)'}
                        </label>
                        <Input
                          type="text"
                          placeholder={gstInputType === 'percentage' ? 'Enter CGST %' : 'Enter CGST amount'}
                          value={cgstInput}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                              setCgstInput(val)
                              const num = val === '' ? 0 : parseFloat(val)
                              if (!isNaN(num)) {
                                setCgst(num)
                              } else {
                                setCgst(0)
                              }
                            }
                          }}
                          className="h-11"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-2 block">
                          SGST {gstInputType === 'percentage' ? '(%)' : '(₹)'}
                        </label>
                        <Input
                          type="text"
                          placeholder={gstInputType === 'percentage' ? 'Enter SGST %' : 'Enter SGST amount'}
                          value={sgstInput}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                              setSgstInput(val)
                              const num = val === '' ? 0 : parseFloat(val)
                              if (!isNaN(num)) {
                                setSgst(num)
                              } else {
                                setSgst(0)
                              }
                            }
                          }}
                          className="h-11"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-2 block">
                          IGST (if applicable) {gstInputType === 'percentage' ? '(%)' : '(₹)'}
                        </label>
                        <Input
                          type="text"
                          placeholder={gstInputType === 'percentage' ? 'Enter IGST %' : 'Enter IGST amount'}
                          value={igstInput}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                              setIgstInput(val)
                              const num = val === '' ? 0 : parseFloat(val)
                              if (!isNaN(num)) {
                                setIgst(num)
                              } else {
                                setIgst(0)
                              }
                            }
                          }}
                          className="h-11"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
          </Card>

            {/* MC/Value Added Section */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-purple-500 text-xl">⚙️</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">MC/Value Added</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Weight (grams)</label>
                    <Input
                      type="text"
                      placeholder="Enter weight (e.g., 0.5, 3.960)"
                    value={mcValueAdded.weightInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                        setMcValueAdded({ ...mcValueAdded, weightInput: val })
                      }
                    }}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Rate</label>
                    <Input
                      type="text"
                      placeholder="Enter rate"
                      value={mcValueAdded.rateInput}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setMcValueAdded({ ...mcValueAdded, rateInput: val })
                        }
                      }}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Total</label>
            <Input
                      type="text"
                      placeholder="Auto-calculated"
                      value={mcValueAdded.total || ''}
                      onChange={(e) => setMcValueAdded({ ...mcValueAdded, total: parseFloat(e.target.value) || 0 })}
                      className="h-11 bg-muted"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Old Gold Exchange Section (Pink Slip) */}
            <Card className="border-2 border-pink-200 dark:border-pink-700 shadow-lg bg-pink-50/30 dark:bg-pink-900/10">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-pink-500 text-xl">🪙</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Old Gold Exchange (Pink Slip)</h2>
                </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-foreground mb-2 block">Particulars / Description</label>
              <Input
                      placeholder="Enter description (e.g., Old gold ornaments)"
                      value={oldGoldExchange.particulars}
                      onChange={(e) => setOldGoldExchange({ ...oldGoldExchange, particulars: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">HSN Code</label>
                    <Input
                      placeholder="HSN Code (default: 7113)"
                      value={oldGoldExchange.hsn_code}
                      onChange={(e) => setOldGoldExchange({ ...oldGoldExchange, hsn_code: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Weight (grams)</label>
                    <Input
                      type="text"
                      placeholder="Enter weight (e.g., 0.5, 3.960)"
                      value={oldGoldExchange.weightInput}
                      onChange={(e) => {
                        const val = e.target.value
                        // Allow empty, numbers, decimals, and negative (for now, we'll validate later)
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setOldGoldExchange({ ...oldGoldExchange, weightInput: val })
                        }
                      }}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Purity (e.g., 916, 22K, 18K)</label>
                    <Input
                      placeholder="Enter purity"
                      value={oldGoldExchange.purity}
                      onChange={(e) => setOldGoldExchange({ ...oldGoldExchange, purity: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Rate per gram (₹)</label>
                    <Input
                      type="text"
                      placeholder={dailyGoldRate > 0 ? `Default: ${dailyGoldRate.toFixed(2)}` : 'Enter rate'}
                      value={oldGoldExchange.rateInput}
                      onChange={(e) => {
                        const val = e.target.value
                        // Allow empty, numbers, decimals
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setOldGoldExchange({ ...oldGoldExchange, rateInput: val })
                        }
                      }}
                      onBlur={(e) => {
                        // When user leaves field, if empty and dailyGoldRate exists, use it
                        if (!oldGoldExchange.rateInput && dailyGoldRate > 0) {
                          setOldGoldExchange({ ...oldGoldExchange, rateInput: dailyGoldRate.toString() })
                        }
                      }}
                      onFocus={(e) => {
                        if (!oldGoldExchange.rateInput && dailyGoldRate > 0) {
                          setOldGoldExchange({ ...oldGoldExchange, rateInput: dailyGoldRate.toString() })
                        }
                      }}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Total Value (₹)</label>
                    <Input
                      type="text"
                      placeholder="Auto-calculated"
                      value={oldGoldExchange.total || ''}
                      onChange={(e) => setOldGoldExchange({ ...oldGoldExchange, total: parseFloat(e.target.value) || 0 })}
                      className="h-11 bg-muted font-semibold"
                      readOnly
                    />
                  </div>
                </div>
                {oldGoldExchange.total > 0 && (
                  <div className="mt-4 p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg border border-pink-300 dark:border-pink-700">
                    <p className="text-sm text-pink-900 dark:text-pink-100">
                      <span className="font-semibold">Pink Slip Value:</span> ₹{oldGoldExchange.total.toFixed(2)} will be created as a purchase bill and credited to this sales bill.
                      {purchaseBillId && (
                        <span className="ml-2 text-xs">(Purchase Bill ID: {purchaseBillId})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Items Section */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-green-500 text-xl">📦</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Add Items</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div className="relative">
              <Input
                      placeholder="Scan or enter barcode"
                value={newItem.barcode}
                onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
                      onKeyDown={async (e) => {
                        // If Enter is pressed, trigger search immediately
                        if (e.key === 'Enter' && newItem.barcode.trim()) {
                          e.preventDefault()
                          await handleSearchBarcode()
                        }
                      }}
                      className="h-11"
                    />
                    {isLoadingItem && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
              <Input
                    placeholder="Item Name *"
                value={newItem.item_name}
                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                    className="h-11"
              />
              <Input
                type="text"
                    placeholder="Weight (grams) * (e.g., 0.5, 3.960)"
                value={newItem.weightInput}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                    setNewItem({ ...newItem, weightInput: val })
                  }
                }}
                    className="h-11"
              />
                  <div className="relative">
              <Input
                type="text"
                      placeholder="Gold Rate (auto from daily rate)"
                      value={dailyGoldRate || ''}
                      disabled
                      className="h-11 bg-muted"
                    />
                    {!dailyGoldRate && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-destructive">
                        Not Set
                      </span>
                    )}
                  </div>
              <Input
                    type="text"
                placeholder="Making charges"
                    value={newItem.makingChargesInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                        setNewItem({ ...newItem, makingChargesInput: val })
                      }
                    }}
                    className="h-11"
              />
            </div>
            <Button
              onClick={handleAddItem}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-lg"
            >
                  + Add Item to Bill
            </Button>
              </div>
          </Card>

          {/* Items Table */}
          {items.length > 0 && (
              <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground">Bill Items</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                <thead>
                        <tr className="border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <th className="text-left py-4 px-4 font-semibold text-foreground">Item</th>
                          <th className="text-left py-4 px-4 font-semibold text-foreground">Weight</th>
                          <th className="text-left py-4 px-4 font-semibold text-foreground">Rate</th>
                          <th className="text-left py-4 px-4 font-semibold text-foreground">Making</th>
                          <th className="text-left py-4 px-4 font-semibold text-foreground">Total</th>
                          <th className="text-center py-4 px-4 font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                          <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="py-4 px-4 font-medium text-foreground">{item.item_name}</td>
                            <td className="py-4 px-4 text-foreground">{item.weight}g</td>
                            <td className="py-4 px-4 text-foreground">₹{item.rate.toFixed(2)}</td>
                            <td className="py-4 px-4 text-foreground">₹{item.making_charges.toFixed(2)}</td>
                            <td className="py-4 px-4 font-bold text-primary text-lg">₹{item.line_total.toFixed(2)}</td>
                            <td className="py-4 px-4 text-center">
                              <button 
                                onClick={() => handleRemoveItem(item.id)} 
                                className="text-destructive hover:text-destructive/80 font-medium px-3 py-1 rounded hover:bg-destructive/10 transition-colors"
                              >
                                Remove
                              </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
                </div>
            </Card>
          )}
        </div>

          {/* Sidebar - Professional Design */}
        <div className="space-y-6">
            {/* Payment Details */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">💳</span>
                  <h3 className="font-bold text-foreground">Payment Details</h3>
                </div>
            <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Payment Method</label>
              <Input
                      placeholder="Enter payment method (cash, card, upi, cheque, etc.)"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-11"
              />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Payment Reference</label>
              <Input
                      placeholder="Transaction ID / Cheque No."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                      className="h-11"
              />
                  </div>
                </div>
            </div>
          </Card>

          {/* Bill Summary */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xl">💰</span>
                  <h3 className="font-bold text-foreground">Bill Summary</h3>
                </div>
            <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-primary/20">
                    <span className="text-muted-foreground font-medium">Subtotal:</span>
                    <span className="text-foreground font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
                  {saleType === 'gst' && billLevelGST > 0 && (
                    <>
                      {cgst > 0 && (
                        <div className="flex justify-between py-2 border-b border-primary/20">
                          <span className="text-muted-foreground">CGST:</span>
                          <span className="text-foreground">
                            {gstInputType === 'percentage' 
                              ? `₹${(subtotal * (cgst / 100)).toFixed(2)}` 
                              : `₹${cgst.toFixed(2)}`}
                          </span>
              </div>
                      )}
                      {sgst > 0 && (
                        <div className="flex justify-between py-2 border-b border-primary/20">
                          <span className="text-muted-foreground">SGST:</span>
                          <span className="text-foreground">
                            {gstInputType === 'percentage' 
                              ? `₹${(subtotal * (sgst / 100)).toFixed(2)}` 
                              : `₹${sgst.toFixed(2)}`}
                          </span>
                        </div>
                      )}
                      {igst > 0 && (
                        <div className="flex justify-between py-2 border-b border-primary/20">
                          <span className="text-muted-foreground">IGST:</span>
                          <span className="text-foreground">
                            {gstInputType === 'percentage' 
                              ? `₹${(subtotal * (igst / 100)).toFixed(2)}` 
                              : `₹${igst.toFixed(2)}`}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b border-primary/20">
                        <span className="text-muted-foreground font-medium">Bill-Level GST:</span>
                        <span className="text-foreground font-semibold">₹{billLevelGST.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {mcValueAdded.total > 0 && (
                    <div className="flex justify-between py-2 border-b border-primary/20">
                      <span className="text-muted-foreground">MC/Value Added:</span>
                      <span className="text-foreground">₹{mcValueAdded.total.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2">
                    <label className="text-muted-foreground block mb-2 font-medium">Discount</label>
                    <Input
                      type="text"
                      value={discountInput}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setDiscountInput(val)
                          const num = val === '' ? 0 : parseFloat(val)
                          if (!isNaN(num)) {
                            setDiscount(num)
                          } else {
                            setDiscount(0)
                          }
                        }
                      }}
                      placeholder="Enter discount"
                      className="h-10 text-sm"
                    />
              </div>
                  {oldGoldExchange.total > 0 && (
                    <div className="flex justify-between py-2 border-b border-primary/20 mt-2">
                      <span className="text-muted-foreground">Old Gold Credit:</span>
                      <span className="text-foreground text-green-600 dark:text-green-400 font-semibold">-₹{oldGoldExchange.total.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t-2 border-primary pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg text-foreground">Amount Payable:</span>
                      <span className="font-bold text-2xl text-primary">₹{amountPayable.toFixed(2)}</span>
                    </div>
                    {oldGoldExchange.total > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground text-center">
                        (After old gold exchange credit)
                      </div>
                    )}
                  </div>
              </div>
            </div>
          </Card>

          {/* Remarks */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">📝</span>
                  <h3 className="font-bold text-foreground">Remarks</h3>
                </div>
                <textarea
                  placeholder="Enter any remarks or notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
                  className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-none min-h-[80px]"
                  rows={3}
                />
              </div>
            </Card>

            {/* Bill Status */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">📊</span>
                  <h3 className="font-bold text-foreground">Bill Status</h3>
                </div>
                <Input
                  placeholder="Enter status (draft, finalized, cancelled)"
                  value={billStatus}
                  onChange={(e) => setBillStatus(e.target.value as 'draft' | 'finalized' | 'cancelled')}
                  className="h-11"
                />
              </div>
          </Card>

          {/* Actions */}
            <div className="space-y-3">
              <Button 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-lg shadow-lg"
                onClick={async () => {
                  // Save bill to database first
                  const saved = await handleSaveBill()
                  if (!saved) {
                    return // Don't proceed if save failed
                  }
                  
                  setBillStatus('finalized')
                  setShowInvoice(true)
                  // Trigger print after a short delay to ensure invoice is rendered
                  setTimeout(() => {
                    window.print()
                    // Hide invoice after printing
                    setTimeout(() => {
                      setShowInvoice(false)
                    }, 500)
                  }, 300)
                }}
              >
                💾🖨️ Save and Print Bill
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Print Component */}
      {showInvoice && (
        <InvoicePrint
          customer={customer as Customer | null}
          billDate={billDate}
          dailyGoldRate={dailyGoldRate}
          items={items}
          mcValueAdded={mcValueAdded}
          oldGoldExchange={oldGoldExchange}
          subtotal={subtotal}
          billLevelGST={billLevelGST}
          discount={discount}
          grandTotal={grandTotal}
          amountPayable={amountPayable}
          billNo={billNo}
          saleType={saleType}
          cgst={cgst}
          sgst={sgst}
          igst={igst}
          gstInputType={gstInputType}
          paymentMethod={paymentMethod}
          paymentReference={paymentReference}
          remarks={remarks}
        />
      )}
    </div>
  )
}

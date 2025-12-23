'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { 
  getCustomersByPhone,
  createCustomer,
  getBills,
  createBill,
  createBillItems,
  createAdvanceBooking,
  updateAdvanceBooking,
  getItemByBarcode,
  BillItem,
  AdvanceBooking,
  Item
} from '@/lib/db/queries'
import { toast } from '@/components/ui/use-toast'

interface BillWithRelations extends Bill {
  customers?: Customer | null
  users?: {
    id: string
    username: string
    role: string
  } | null
}

interface AdvanceBookingWithBill extends AdvanceBooking {
  bill?: BillWithRelations | null
}

interface Customer {
  id: number
  name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

interface AdvanceBookingFormData {
  customer: Customer | null
  customerPhone: string
  customerName: string
  customerEmail: string
  customerAddress: string
  customerNotes: string
  goldRequirements: BillItem[]
  newItemName: string
  newItemWeight: string
  newItemPurity: string
  newItemMakingCharges: string
  newItemBarcode: string
  totalAmount: number
  advanceAmount: number
  amountDue: number
  deliveryDate: string
  itemDescription: string
  customerNotes: string
}

interface AdvanceBookingFormProps {
  isEditMode?: boolean;
  onCancel?: () => void;
  onSubmitSuccess?: () => void;
  bookingData?: AdvanceBookingWithBill; // For editing existing bookings
}

export function AdvanceBookingForm({ isEditMode = false, onCancel, onSubmitSuccess, bookingData }: AdvanceBookingFormProps = {}) {
  const [formData, setFormData] = useState<AdvanceBookingFormData>(() => {
    // If editing, initialize with booking data
    if (bookingData) {
      return {
        customer: bookingData.bill?.customers || null,
        customerPhone: bookingData.bill?.customers?.phone || '',
        customerName: bookingData.bill?.customers?.name || '',
        customerEmail: bookingData.bill?.customers?.email || '',
        customerAddress: bookingData.bill?.customers?.address || '',
        customerNotes: bookingData.bill?.customers?.notes || '',
        goldRequirements: [], // Would need to fetch bill items separately
        newItemName: '',
        newItemWeight: '',
        newItemPurity: '',
        newItemMakingCharges: '',
        newItemBarcode: '',
        totalAmount: bookingData.total_amount,
        advanceAmount: bookingData.advance_amount,
        amountDue: bookingData.total_amount - bookingData.advance_amount,
        deliveryDate: bookingData.delivery_date,
        itemDescription: bookingData.item_description || '',
        customerNotes: bookingData.customer_notes || ''
      }
    }
    
    // Default values for new booking
    return {
      customer: null,
      customerPhone: '',
      customerName: '',
      customerEmail: '',
      customerAddress: '',
      customerNotes: '',
      goldRequirements: [],
      newItemName: '',
      newItemWeight: '',
      newItemPurity: '',
      newItemMakingCharges: '',
      newItemBarcode: '',
      totalAmount: 0,
      advanceAmount: 0,
      amountDue: 0,
      deliveryDate: '',
      itemDescription: '',
      customerNotes: ''
    }
  })

  // Initialize total amount lock state
  useEffect(() => {
    if (bookingData) {
      // When editing, the total amount is effectively "locked" since it comes from the database
      setIsTotalAmountLocked(true)
    } else {
      setIsTotalAmountLocked(false)
    }
  }, [bookingData])
  
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [dailyGoldRate, setDailyGoldRate] = useState(0)
  const [isSearchingItem, setIsSearchingItem] = useState(false)
  const [isTotalAmountLocked, setIsTotalAmountLocked] = useState(false)

  // Load daily gold rate on component mount
  useEffect(() => {
    const loadGoldRate = async () => {
      try {
        // In a real app, you would fetch this from your gold rates table
        // For now, using a default value
        setDailyGoldRate(6000) // Default gold rate per gram
      } catch (error) {
        console.error('Error loading gold rate:', error)
        toast({
          title: 'Error',
          description: 'Failed to load daily gold rate',
          variant: 'destructive',
        })
      }
    }
    
    loadGoldRate()
  }, [])

  // Auto-fetch item details when barcode is scanned/entered
  useEffect(() => {
    const barcodeValue = formData.newItemBarcode.trim()
    if (!barcodeValue) {
      console.log('No barcode value, skipping search')
      setIsSearchingItem(false)
      return
    }

    console.log('Starting barcode search for:', barcodeValue)
    
    // Debounce the search to avoid too many API calls
    const searchItem = async () => {
      setIsSearchingItem(true)
      try {
        console.log('Fetching item by barcode:', barcodeValue)
        const item = await getItemByBarcode(barcodeValue)
        
        if (item) {
          console.log('Item found in database:', item)
          // Auto-populate item fields from database
          setFormData(prev => ({
            ...prev,
            newItemName: item.item_name || prev.newItemName,
            newItemWeight: item.weight?.toString() || prev.newItemWeight,
            newItemPurity: item.purity || prev.newItemPurity,
            newItemMakingCharges: item.making_charges?.toString() || prev.newItemMakingCharges,
          }))
          
          toast({
            title: 'Item Found',
            description: `Successfully loaded: ${item.item_name || 'Unnamed item'}`,
          })
        } else {
          console.log('No item found for barcode:', barcodeValue)
        }
      } catch (error: any) {
        console.error('Error searching for item by barcode:', error)
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
        })
        
        // Item not found - that's okay, user can enter manually
        if (error.code === 'PGRST116') {
          console.log('Item not found for barcode:', barcodeValue)
        } else {
          console.error('Error searching for item:', error)
        }
      } finally {
        setIsSearchingItem(false)
      }
    }

    // Wait 300ms after user stops typing before searching
    const debounceTimer = setTimeout(searchItem, 300)
    return () => clearTimeout(debounceTimer)
  }, [formData.newItemBarcode])

  // Calculate amount due when total amount or advance amount changes
  useEffect(() => {
    const amountDue = formData.totalAmount - formData.advanceAmount
    setFormData(prev => ({
      ...prev,
      amountDue: Math.max(0, amountDue)
    }))
  }, [formData.totalAmount, formData.advanceAmount])

  // Handle manual input for total amount
  const handleTotalAmountChange = (value: string) => {
    const total = parseFloat(value) || 0
    setFormData(prev => ({
      ...prev,
      totalAmount: total
    }))
    // Lock the total amount when manually changed
    setIsTotalAmountLocked(true)
  }

  // Handle manual input for advance amount
  const handleAdvanceAmountChange = (value: string) => {
    const advance = parseFloat(value) || 0
    setFormData(prev => ({
      ...prev,
      advanceAmount: advance
    }))
  }

  const handleSearchCustomer = async () => {
    if (!formData.customerPhone.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number to search',
        variant: 'destructive',
      })
      return
    }

    console.log('Searching for customer with phone:', formData.customerPhone.trim())
    setIsSearching(true)
    try {
      const customers = await getCustomersByPhone(formData.customerPhone.trim())
      console.log('Search results:', customers)
      
      if (customers.length > 0) {
        console.log('Customer found:', customers[0])
        setExistingCustomer(customers[0])
        setFormData(prev => ({
          ...prev,
          customer: customers[0],
          customerName: customers[0].name || '',
          customerEmail: customers[0].email || '',
          customerAddress: customers[0].address || '',
          customerNotes: customers[0].notes || ''
        }))
        toast({
          title: 'Customer Found',
          description: `Found customer: ${customers[0].name || 'N/A'}`
        })
      } else {
        console.log('No customer found with phone:', formData.customerPhone.trim())
        setExistingCustomer(null)
        setFormData(prev => ({
          ...prev,
          customer: null
        }))
        toast({
          title: 'Customer Not Found',
          description: 'Customer does not exist. Please add new customer details.'
        })
      }
    } catch (error: any) {
      console.error('Error searching customer:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      toast({
        title: 'Error',
        description: error.message || 'Failed to search customer',
        variant: 'destructive',
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleCreateCustomer = async () => {
    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      toast({
        title: 'Error',
        description: 'Name and phone are required to create a customer',
        variant: 'destructive',
      })
      return
    }

    console.log('Creating customer with data:', {
      name: formData.customerName.trim(),
      phone: formData.customerPhone.trim(),
      email: formData.customerEmail.trim() || null,
      address: formData.customerAddress.trim() || null,
      notes: formData.customerNotes.trim() || null,
    })
    
    setIsCreatingCustomer(true)
    try {
      const newCustomer = await createCustomer({
        name: formData.customerName.trim(),
        phone: formData.customerPhone.trim(),
        email: formData.customerEmail.trim() || null,
        address: formData.customerAddress.trim() || null,
        notes: formData.customerNotes.trim() || null,
      })
      
      console.log('Customer created successfully:', newCustomer)

      setExistingCustomer(newCustomer)
      setFormData(prev => ({
        ...prev,
        customer: newCustomer
      }))

      toast({
        title: 'Customer Created',
        description: `Customer ${newCustomer.name} has been created successfully`
      })
    } catch (error: any) {
      console.error('Error creating customer:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      toast({
        title: 'Error',
        description: error.message || 'Failed to create customer',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const handleAddGoldItem = () => {
    if (!formData.newItemName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an item name',
        variant: 'destructive',
      })
      return
    }

    const weight = parseFloat(formData.newItemWeight) || 0
    if (weight <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid weight',
        variant: 'destructive',
      })
      return
    }

    const purity = formData.newItemPurity.trim()
    if (!purity) {
      toast({
        title: 'Error',
        description: 'Please enter purity (e.g., 916, 22K)',
        variant: 'destructive',
      })
      return
    }

    console.log('Adding gold item with data:', {
      name: formData.newItemName.trim(),
      weight,
      purity,
      makingCharges: parseFloat(formData.newItemMakingCharges) || 0,
      barcode: formData.newItemBarcode.trim() || null
    })
    
    const makingCharges = parseFloat(formData.newItemMakingCharges) || 0
    const goldValue = weight * dailyGoldRate
    const itemTotal = goldValue + makingCharges

    const newItem: BillItem = {
      id: Date.now().toString(), // temporary ID
      item_name: formData.newItemName.trim(),
      weight,
      rate: dailyGoldRate,
      making_charges: makingCharges,
      gst_rate: 0, // GST will be calculated at bill level
      line_total: itemTotal,
      purity,
      hsn_code: '711319',
      sl_no: formData.goldRequirements.length + 1,
      barcode: formData.newItemBarcode.trim() || null // Adding barcode if available
    }

    // Calculate new total amount based on all items
    const newTotalAmountFromItems = formData.goldRequirements.reduce((sum, item) => sum + item.line_total, 0) + itemTotal;
    
    console.log('New total amount calculation:', {
      currentItemsTotal: formData.goldRequirements.reduce((sum, item) => sum + item.line_total, 0),
      newItemTotal: itemTotal,
      newTotalAmountFromItems,
      isTotalAmountLocked,
      finalTotalAmount: isTotalAmountLocked ? formData.totalAmount : newTotalAmountFromItems
    })
    
    setFormData(prev => ({
      ...prev,
      goldRequirements: [...prev.goldRequirements, newItem],
      // Only update totalAmount if it's not locked, otherwise keep the locked value
      totalAmount: isTotalAmountLocked ? prev.totalAmount : newTotalAmountFromItems,
      newItemName: '',
      newItemWeight: '',
      newItemPurity: '',
      newItemMakingCharges: '',
      newItemBarcode: ''
    }))

    toast({
      title: 'Item Added',
      description: `${formData.newItemName} has been added to requirements`
    })
  }

  const handleRemoveGoldItem = (index: number) => {
    const updatedGoldRequirements = formData.goldRequirements.filter((_, i) => i !== index)
    const newTotalAmountFromItems = updatedGoldRequirements.reduce((sum, item) => sum + item.line_total, 0)

    setFormData(prev => ({
      ...prev,
      goldRequirements: updatedGoldRequirements,
      // Only update totalAmount if it's not locked, otherwise keep the locked value
      totalAmount: isTotalAmountLocked ? prev.totalAmount : newTotalAmountFromItems
    }))
  }

  const validateForm = () => {
    if (!formData.customer) {
      toast({
        title: 'Error',
        description: 'Please select or create a customer',
        variant: 'destructive',
      })
      return false
    }

    if (formData.totalAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Total amount must be greater than 0',
        variant: 'destructive',
      })
      return false
    }

    if (formData.goldRequirements.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one gold requirement',
        variant: 'destructive',
      })
      return false
    }

    if (formData.advanceAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Advance amount must be greater than 0',
        variant: 'destructive',
      })
      return false
    }

    if (formData.totalAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Total amount must be greater than 0',
        variant: 'destructive',
      })
      return false
    }

    if (formData.advanceAmount > formData.totalAmount) {
      toast({
        title: 'Error',
        description: 'Advance amount cannot be greater than total amount',
        variant: 'destructive',
      })
      return false
    }

    // If total amount is locked (manually entered), validate that it's reasonable
    if (isTotalAmountLocked && formData.totalAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Total amount must be greater than 0 when manually entered',
        variant: 'destructive',
      })
      return false
    }

    if (formData.advanceAmount < 0) {
      toast({
        title: 'Error',
        description: 'Advance amount cannot be negative',
        variant: 'destructive',
      })
      return false
    }

    if (formData.totalAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Total amount must be greater than 0',
        variant: 'destructive',
      })
      return false
    }

    if (!formData.deliveryDate) {
      toast({
        title: 'Error',
        description: 'Please select a delivery date',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      console.log('Form validation failed')
      return
    }

    try {
      console.log('Starting advance booking submission...')
      console.log('Form data:', formData)
      console.log('Customer data:', formData.customer)
      
      if (isEditMode && bookingData) {
        console.log('Updating existing booking with ID:', bookingData.id)
        // Update existing advance booking
        await updateAdvanceBooking(bookingData.id, {
          delivery_date: formData.deliveryDate,
          advance_amount: formData.advanceAmount,
          total_amount: formData.totalAmount,
          item_description: formData.itemDescription,
          customer_notes: formData.customerNotes,
        })
        console.log('Booking updated successfully')
      } else {
        console.log('Creating new booking...')
        console.log('Customer ID:', formData.customer?.id)
        
        // Create the bill first
        const billData = {
          customer_id: formData.customer!.id,
          bill_date: new Date().toISOString().split('T')[0],
          subtotal: formData.totalAmount,
          gst_amount: 0, // Will be calculated based on sale type
          cgst: 0,
          sgst: 0,
          igst: 0,
          discount: 0,
          grand_total: formData.totalAmount,
          payment_method: JSON.stringify([{
            id: 'advance',
            type: 'cash',
            amount: formData.advanceAmount.toString(),
            reference: 'Advance booking payment'
          }]),
          bill_status: 'finalized' as const,
        }
        
        console.log('Creating bill with data:', billData)
        const bill = await createBill(billData)
        console.log('Bill created successfully with ID:', bill.id)

        // Validate bill ID and gold requirements before creating bill items
        if (!bill.id) {
          throw new Error('Bill ID is missing after bill creation')
        }
        
        if (formData.goldRequirements.length === 0) {
          throw new Error('No gold requirements specified')
        }
        
        // Create bill items
        const billItemsData = formData.goldRequirements.map((item, index) => {
          // Validate each item has required data
          if (!item.item_name) {
            throw new Error(`Item ${index + 1} is missing name`)
          }
          if (!item.weight || item.weight <= 0) {
            throw new Error(`Item ${index + 1} (${item.item_name}) has invalid weight: ${item.weight}`)
          }
          if (!item.rate || item.rate <= 0) {
            throw new Error(`Item ${index + 1} (${item.item_name}) has invalid rate: ${item.rate}`)
          }
          if (!item.line_total || item.line_total <= 0) {
            throw new Error(`Item ${index + 1} (${item.item_name}) has invalid line total: ${item.line_total}`)
          }
          
          return {
            bill_id: bill.id,
            item_name: item.item_name,
            weight: item.weight,
            rate: item.rate,
            making_charges: item.making_charges,
            gst_rate: item.gst_rate,
            line_total: item.line_total,
            barcode: item.barcode || undefined // Use undefined instead of null to avoid schema issues
          }
        })
        
        console.log('Creating bill items:', billItemsData)
        console.log('Bill ID for items:', bill.id)
        await createBillItems(bill.id, billItemsData)
        console.log('Bill items created successfully')

        // Create advance booking
        const bookingData = {
          bill_id: bill.id,
          booking_date: new Date().toISOString().split('T')[0],
          delivery_date: formData.deliveryDate,
          advance_amount: formData.advanceAmount,
          total_amount: formData.totalAmount,
          item_description: formData.itemDescription,
          customer_notes: formData.customerNotes,
          booking_status: 'active'
        }
        
        console.log('Creating advance booking with data:', bookingData)
        await createAdvanceBooking(bookingData)
        console.log('Advance booking created successfully')
      }

      toast({
        title: 'Success',
        description: isEditMode ? 'Advance booking updated successfully' : 'Advance booking created successfully'
      })

      // Reset form
      setFormData({
        customer: null,
        customerPhone: '',
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        customerNotes: '',
        goldRequirements: [],
        newItemName: '',
        newItemWeight: '',
        newItemPurity: '',
        newItemMakingCharges: '',
        newItemBarcode: '',
        totalAmount: 0,
        advanceAmount: 0,
        amountDue: 0,
        deliveryDate: '',
        itemDescription: '',
        customerNotes: ''
      })
      setExistingCustomer(null)
      setIsTotalAmountLocked(false)
      
      // Call success callback if provided
      if (onSubmitSuccess) {
        onSubmitSuccess()
      }
    } catch (error: any) {
      console.error('Error creating advance booking:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      
      // Check for specific error types
      if (error.message?.includes('foreign key')) {
        console.error('Foreign key constraint error - likely customer ID issue')
      } else if (error.message?.includes('null value')) {
        console.error('Null value constraint error - missing required field')
      } else if (error.message?.includes('unique constraint')) {
        console.error('Unique constraint error')
      } else if (error.message?.includes('customer_id')) {
        console.error('Customer ID error - customer might not exist')
      } else if (error.message?.includes('bill_id')) {
        console.error('Bill ID error')
      }
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to create advance booking',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Advance Booking</h1>
          <p className="text-muted-foreground">
            Create advance bookings for customer orders
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Customer Section */}
          <Card className="p-6 mb-6 border-2 border-slate-200 dark:border-slate-700 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Customer Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <div className="flex gap-2">
                  <Input
                    id="customerPhone"
                    type="text"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    placeholder="Enter customer phone number"
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSearchCustomer}
                    disabled={isSearching}
                    className="h-10"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
              
              {existingCustomer ? (
                <div className="flex items-end">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Existing Customer</p>
                    <p className="font-semibold text-foreground">{existingCustomer.name || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">{existingCustomer.phone}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    placeholder="Customer name"
                    className="h-10"
                  />
                </div>
              )}
            </div>

            {!existingCustomer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                    placeholder="Customer email"
                    className="h-10"
                  />
                </div>
                
                <div>
                  <Label htmlFor="customerAddress">Address</Label>
                  <Input
                    id="customerAddress"
                    type="text"
                    value={formData.customerAddress}
                    onChange={(e) => setFormData({...formData, customerAddress: e.target.value})}
                    placeholder="Customer address"
                    className="h-10"
                  />
                </div>
              </div>
            )}

            {!existingCustomer && (
              <div className="mb-4">
                <Label htmlFor="customerNotes">Customer Notes</Label>
                <Input
                  id="customerNotes"
                  type="text"
                  value={formData.customerNotes}
                  onChange={(e) => setFormData({...formData, customerNotes: e.target.value})}
                  placeholder="Additional notes about customer"
                  className="h-10"
                />
              </div>
            )}

            {!existingCustomer && (
              <Button
                type="button"
                variant="default"
                onClick={handleCreateCustomer}
                disabled={isCreatingCustomer}
                className="h-10"
              >
                {isCreatingCustomer ? 'Creating Customer...' : 'Create New Customer'}
              </Button>
            )}
          </Card>

          {/* Gold Requirements Section */}
          <Card className="p-6 mb-6 border-2 border-slate-200 dark:border-slate-700 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Gold Requirements</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <Label htmlFor="newItemName">Item Name *</Label>
                <Input
                  id="newItemName"
                  type="text"
                  value={formData.newItemName}
                  onChange={(e) => setFormData({...formData, newItemName: e.target.value})}
                  placeholder="Item name"
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="newItemWeight">Weight (grams) *</Label>
                <Input
                  id="newItemWeight"
                  type="text"
                  value={formData.newItemWeight}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                      setFormData({...formData, newItemWeight: val})
                    }
                  }}
                  placeholder="Weight in grams"
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="newItemPurity">Purity *</Label>
                <Input
                  id="newItemPurity"
                  type="text"
                  value={formData.newItemPurity}
                  onChange={(e) => setFormData({...formData, newItemPurity: e.target.value})}
                  placeholder="Purity (e.g., 916, 22K)"
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="newItemMakingCharges">Making Charges</Label>
                <Input
                  id="newItemMakingCharges"
                  type="text"
                  value={formData.newItemMakingCharges}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                      setFormData({...formData, newItemMakingCharges: val})
                    }
                  }}
                  placeholder="Making charges"
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="newItemBarcode">Barcode</Label>
                <div className="relative">
                  <Input
                    id="newItemBarcode"
                    type="text"
                    value={formData.newItemBarcode}
                    onChange={(e) => setFormData({...formData, newItemBarcode: e.target.value})}
                    placeholder="Item barcode"
                    className="h-10 pr-10"
                  />
                  {isSearchingItem && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleAddGoldItem}
              className="w-full h-10"
            >
              + Add Gold Requirement
            </Button>

            {formData.goldRequirements.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-foreground mb-2">Added Requirements:</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-3 font-medium">Item</th>
                        <th className="text-left py-2 px-3 font-medium">Barcode</th>
                        <th className="text-left py-2 px-3 font-medium">Weight</th>
                        <th className="text-left py-2 px-3 font-medium">Purity</th>
                        <th className="text-left py-2 px-3 font-medium">Making</th>
                        <th className="text-left py-2 px-3 font-medium">Total</th>
                        <th className="text-center py-2 px-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.goldRequirements.map((item, index) => (
                        <tr key={index} className="border-b border-slate-200 dark:border-slate-700">
                          <td className="py-2 px-3">{item.item_name}</td>
                          <td className="py-2 px-3">{item.barcode || '-'}</td>
                          <td className="py-2 px-3">{item.weight}g</td>
                          <td className="py-2 px-3">{item.purity}</td>
                          <td className="py-2 px-3">₹{item.making_charges.toFixed(2)}</td>
                          <td className="py-2 px-3 font-semibold">₹{item.line_total.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveGoldItem(index)}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* Payment and Delivery Section */}
          <Card className="p-6 mb-6 border-2 border-slate-200 dark:border-slate-700 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Payment & Delivery</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="totalAmount">Total Amount (₹) *</Label>
                <div className="relative">
                  <Input
                    id="totalAmount"
                    type="text"
                    value={formData.totalAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                        handleTotalAmountChange(val)
                      }
                    }}
                    placeholder="Enter total amount"
                    className="h-10 pr-16"
                  />
                  {isTotalAmountLocked && (
                    <div className="absolute right-20 top-1/2 -translate-y-1/2">
                      <span className="text-xs text-muted-foreground">locked</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs px-2"
                    onClick={() => {
                      // Unlock and recalculate from items
                      setIsTotalAmountLocked(false);
                      const recalculatedTotal = formData.goldRequirements.reduce((sum, item) => sum + item.line_total, 0);
                      setFormData(prev => ({
                        ...prev,
                        totalAmount: recalculatedTotal
                      }));
                    }}
                  >
                    {isTotalAmountLocked ? 'Unlock' : 'Auto'}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="advanceAmount">Advance Amount (₹) *</Label>
                <Input
                  id="advanceAmount"
                  type="text"
                  value={formData.advanceAmount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                      handleAdvanceAmountChange(val)
                    }
                  }}
                  placeholder="Amount paid in advance"
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="amountDue">Amount Due (₹)</Label>
                <Input
                  id="amountDue"
                  type="text"
                  value={formData.amountDue.toFixed(2)}
                  readOnly
                  className="h-10 bg-muted font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="deliveryDate">Delivery Date *</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})}
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="itemDescription">Item Description</Label>
                <Input
                  id="itemDescription"
                  type="text"
                  value={formData.itemDescription}
                  onChange={(e) => setFormData({...formData, itemDescription: e.target.value})}
                  placeholder="Brief description of items"
                  className="h-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customerNotesFinal">Customer Notes</Label>
              <Input
                id="customerNotesFinal"
                type="text"
                value={formData.customerNotes}
                onChange={(e) => setFormData({...formData, customerNotes: e.target.value})}
                placeholder="Any special notes from customer"
                className="h-10"
              />
            </div>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            {isEditMode && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="h-12 px-8 text-lg"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              className="h-12 px-8 text-lg"
            >
              {isEditMode ? 'Update Advance Booking' : 'Create Advance Booking'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
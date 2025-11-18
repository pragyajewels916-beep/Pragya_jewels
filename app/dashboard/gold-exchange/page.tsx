'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'

interface GoldExchange {
  id: number
  bill_id: number
  weight: number
  purity: string | null
  rate_per_gram: number
  total_value: number
  notes: string | null
  created_at: string
  bills?: {
    bill_no: string
    bill_date: string
    customers?: {
      name: string
      phone: string
    }
  }
}

export default function GoldExchangePage() {
  const [exchanges, setExchanges] = useState<GoldExchange[]>([])
  const [filteredExchanges, setFilteredExchanges] = useState<GoldExchange[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchGoldExchanges()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [exchanges, searchTerm, startDate, endDate])

  const fetchGoldExchanges = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('old_gold_exchanges')
        .select(`
          *,
          bills!inner(
            bill_no,
            bill_date,
            customers(
              name,
              phone
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching gold exchanges:', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch gold exchange data',
          variant: 'destructive',
        })
        return
      }

      setExchanges((data as any[]) || [])
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Error',
        description: 'An error occurred while fetching gold exchanges',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...exchanges]

    // Search filter (bill number, customer name, phone)
    if (searchTerm) {
      filtered = filtered.filter(exchange => {
        const billNo = exchange.bills?.bill_no?.toLowerCase() || ''
        const customerName = exchange.bills?.customers?.name?.toLowerCase() || ''
        const customerPhone = exchange.bills?.customers?.phone || ''
        const searchLower = searchTerm.toLowerCase()
        return billNo.includes(searchLower) || 
               customerName.includes(searchLower) || 
               customerPhone.includes(searchTerm)
      })
    }

    // Date filter
    if (startDate) {
      filtered = filtered.filter(exchange => {
        const exchangeDate = new Date(exchange.created_at)
        const start = new Date(startDate)
        return exchangeDate >= start
      })
    }
    if (endDate) {
      filtered = filtered.filter(exchange => {
        const exchangeDate = new Date(exchange.created_at)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        return exchangeDate <= end
      })
    }

    setFilteredExchanges(filtered)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const parseNotes = (notes: string | null) => {
    if (!notes) return { particulars: 'Old Gold Exchange', hsnCode: '7113' }
    
    let particulars = 'Old Gold Exchange'
    let hsnCode = '7113'
    
    if (notes.includes('Description:')) {
      const descMatch = notes.match(/Description:\s*([^|]+)/)
      if (descMatch) particulars = descMatch[1].trim()
    }
    if (notes.includes('HSN Code:')) {
      const hsnMatch = notes.match(/HSN Code:\s*([^|]+)/)
      if (hsnMatch) hsnCode = hsnMatch[1].trim()
    }
    
    return { particulars, hsnCode }
  }

  const totalExchanged = filteredExchanges.reduce((sum, exchange) => sum + (exchange.total_value || 0), 0)
  const totalWeight = filteredExchanges.reduce((sum, exchange) => sum + (exchange.weight || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Gold Exchange</h1>
          <p className="text-muted-foreground">
            View all old gold exchanges and their related sales bills
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Exchanges</p>
                <p className="text-xl font-bold text-foreground">{filteredExchanges.length}</p>
              </div>
              <div className="text-2xl">🪙</div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Weight</p>
                <p className="text-xl font-bold text-foreground">{totalWeight.toFixed(2)}g</p>
              </div>
              <div className="text-2xl">⚖️</div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalExchanged)}</p>
              </div>
              <div className="text-2xl">💰</div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-primary text-lg">🔍</span>
            <h2 className="text-base font-semibold text-foreground">Filters</h2>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <label className="text-xs font-medium text-foreground mb-1 block">Search</label>
              <Input
                type="text"
                placeholder="Bill number, customer name or phone"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-foreground mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-foreground mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setStartDate('')
                  setEndDate('')
                }}
                className="h-9 text-sm px-4"
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>

        {/* Gold Exchange Table */}
        <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-primary text-lg">🪙</span>
                <h2 className="text-lg font-semibold text-foreground">Gold Exchange Records</h2>
              </div>
              <Button
                variant="outline"
                onClick={() => fetchGoldExchanges()}
                disabled={isLoading}
                className="h-8 text-xs"
                size="sm"
              >
                {isLoading ? '🔄' : '↻'} Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredExchanges.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No gold exchanges found</p>
                <p className="text-muted-foreground text-sm mt-2">
                  {exchanges.length === 0 
                    ? 'No gold exchanges have been recorded yet'
                    : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Date</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Bill No</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Customer</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Particulars</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">HSN Code</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Weight (g)</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Purity</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Rate/g</th>
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExchanges.map((exchange) => {
                      const { particulars, hsnCode } = parseNotes(exchange.notes)
                      return (
                        <tr
                          key={exchange.id}
                          className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <td className="py-4 px-4 text-foreground">{formatDate(exchange.created_at)}</td>
                          <td className="py-4 px-4 font-medium text-foreground">
                            {exchange.bills?.bill_no || `#${exchange.bill_id}`}
                          </td>
                          <td className="py-4 px-4 text-foreground">
                            {exchange.bills?.customers ? (
                              <div>
                                <div className="font-medium">{exchange.bills.customers.name || 'N/A'}</div>
                                {exchange.bills.customers.phone && (
                                  <div className="text-sm text-muted-foreground">{exchange.bills.customers.phone}</div>
                                )}
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="py-4 px-4 text-foreground">{particulars}</td>
                          <td className="py-4 px-4 text-foreground">{hsnCode}</td>
                          <td className="py-4 px-4 text-foreground">{exchange.weight?.toFixed(2) || '0.00'}</td>
                          <td className="py-4 px-4 text-foreground">{exchange.purity || '-'}</td>
                          <td className="py-4 px-4 text-foreground">{formatCurrency(exchange.rate_per_gram)}</td>
                          <td className="py-4 px-4 font-bold text-primary text-lg">
                            {formatCurrency(exchange.total_value)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}


import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getSearchInsights } from '@/services/search-insights.service'

export function SearchInsightsPage() {
  const [city, setCity] = useState('')
  const [days, setDays] = useState(7)
  const [submittedCity, setSubmittedCity] = useState('')

  const q = useQuery({
    queryKey: ['search-insights', submittedCity, days],
    queryFn: () => getSearchInsights(submittedCity, days),
    enabled: submittedCity.length >= 2,
  })

  function run() {
    const c = city.trim()
    if (c.length < 2) return
    setSubmittedCity(c)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Search insights</h1>
        <p className="text-muted-foreground text-sm">
          Popular and zero-result searches from discovery, scoped by city.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query</CardTitle>
          <CardDescription>
            City is required. Days is the lookback window (1–90).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="si-city">City</Label>
            <Input
              id="si-city"
              placeholder="e.g. Mumbai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="si-days">Days</Label>
            <Input
              id="si-days"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 7)}
              className="w-24"
            />
          </div>
          <Button type="button" onClick={run}>
            Load
          </Button>
        </CardContent>
      </Card>

      {!submittedCity && (
        <p className="text-muted-foreground text-sm">Enter a city and press Load.</p>
      )}

      {submittedCity && q.isLoading && <Skeleton className="h-64 w-full" />}

      {submittedCity && q.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Popular searches</CardTitle>
              <CardDescription>{submittedCity} · last {days} days</CardDescription>
            </CardHeader>
            <CardContent>
              {q.data.popular.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Query</th>
                      <th className="pb-2 font-medium text-right">Searches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.popular.map((row) => (
                      <tr key={row.query} className="border-border/80 border-b">
                        <td className="py-2 pr-4">{row.query}</td>
                        <td className="py-2 text-right tabular-nums">{row.searches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Searches with no results</CardTitle>
              <CardDescription>Demand signals for catalog gaps</CardDescription>
            </CardHeader>
            <CardContent>
              {q.data.noResults.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Query</th>
                      <th className="pb-2 font-medium text-right">Searches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.noResults.map((row) => (
                      <tr key={row.query} className="border-border/80 border-b">
                        <td className="py-2 pr-4">{row.query}</td>
                        <td className="py-2 text-right tabular-nums">{row.searches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

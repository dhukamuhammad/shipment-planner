import React, { useState } from 'react'
import {
  IndianRupee, ShoppingBag, Users, Wallet, TrendingUp, TrendingDown,
  ArrowUpRight, Package, Clock, CheckCircle2, RefreshCcw,
} from 'lucide-react'

// ---- demo data, apne API se replace kar dena ----
const chartSets = {
  Revenue: [32, 40, 38, 52, 48, 60, 58, 72, 68, 80, 78, 92],
  Orders: [18, 22, 20, 28, 26, 34, 30, 40, 38, 46, 44, 52],
  Profit: [10, 14, 12, 18, 16, 22, 20, 28, 25, 32, 30, 38],
}
const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const secondaryStats = [
  { label: 'Total Orders', value: '1,284', delta: '+8.1%', up: true, icon: ShoppingBag },
  { label: 'Active Customers', value: '9,340', delta: '+3.4%', up: true, icon: Users },
  { label: 'Avg. Order Value', value: '₹1,940', delta: '-1.2%', up: false, icon: Wallet },
]

const topProducts = [
  { name: 'Wireless Earbuds Pro', sales: 412, share: 92 },
  { name: 'Smart Fitness Band', sales: 356, share: 78 },
  { name: 'Ceramic Coffee Mug Set', sales: 298, share: 64 },
  { name: 'Bluetooth Speaker Mini', sales: 210, share: 45 },
]

const activity = [
  { text: 'Settlement of ₹32,110 credited by Amazon', time: '10 min ago', icon: CheckCircle2, color: '#22B573' },
  { text: 'New order batch synced — 46 orders', time: '48 min ago', icon: RefreshCcw, color: '#5A5DF6' },
  { text: 'SKU mismatch flagged in Orders page', time: '2 hr ago', icon: Package, color: '#F4C542' },
  { text: 'Reconciliation report generated', time: '5 hr ago', icon: Clock, color: '#1C2340' },
]

// ---- small chart building block ----
const AreaChart = ({ data }) => {
  const w = 600, h = 180, max = Math.max(...data), min = Math.min(...data)
  const step = w / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / (max - min)) * (h - 20) - 10
    return `${x},${y}`
  })
  const linePath = `M${points.join(' L')}`
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A5DF6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#5A5DF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaFill)" />
      <path d={linePath} fill="none" stroke="#5A5DF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = i * step
        const y = h - ((v - min) / (max - min)) * (h - 20) - 10
        return <circle key={i} cx={x} cy={y} r="3" fill="#FFFFFF" stroke="#5A5DF6" strokeWidth="2" />
      })}
    </svg>
  )
}

const Sparkline = ({ data }) => {
  const w = 160, h = 40, max = Math.max(...data), min = Math.min(...data)
  const step = w / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / (max - min)) * h}`).join(' L')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
      <path d={`M${points}`} fill="none" stroke="#F4C542" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const Dashboard = () => {
  const [tab, setTab] = useState('Revenue')
  const [period, setPeriod] = useState('30D')

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2340]">Overview</h1>
          <p className="text-sm text-[#1C2340]/50 mt-0.5">Your store's performance at a glance</p>
        </div>
        <div className="flex bg-white border border-[#D9DDE5] rounded-[4px] p-1">
          {['7D', '30D', '90D'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[3px] transition-all ${
                period === p ? 'bg-[#5A5DF6] text-white' : 'text-[#1C2340]/50 hover:text-[#1C2340]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Bento row: hero spotlight + compact stat rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Hero panel */}
        <div className="lg:col-span-2 bg-[#1C2340] rounded-[5px] p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#5A5DF6]/10 rounded-full" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Total Revenue · {period}</p>
              <div className="flex items-baseline gap-3 mt-2">
                <h2 className="text-4xl font-bold text-white">₹4,82,320</h2>
                <span className="flex items-center gap-1 text-[#22B573] text-sm font-semibold bg-[#22B573]/15 px-2 py-0.5 rounded-[4px]">
                  <ArrowUpRight size={14} /> 12.5%
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-[5px] bg-white/10 flex items-center justify-center">
              <IndianRupee size={20} className="text-[#F4C542]" />
            </div>
          </div>

          <div className="relative z-10 mt-6">
            <p className="text-xs text-white/40 mb-1">Settlement pace</p>
            <Sparkline data={chartSets.Revenue} />
          </div>
        </div>

        {/* Compact stat rail */}
        <div className="bg-white border border-[#D9DDE5] rounded-[5px] divide-y divide-[#D9DDE5]">
          {secondaryStats.map(({ label, value, delta, up, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-[4px] bg-[#F4F5F7] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-[#5A5DF6]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#1C2340]/50">{label}</p>
                <p className="text-base font-bold text-[#1C2340]">{value}</p>
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-[#22B573]' : 'text-[#E74C3C]'}`}>
                {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabbed chart panel */}
      <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-[#F4F5F7] rounded-[4px] p-1">
            {Object.keys(chartSets).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-[3px] transition-all ${
                  tab === key ? 'bg-white text-[#3F46E8] shadow-sm' : 'text-[#1C2340]/50 hover:text-[#1C2340]'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#1C2340]/40">Jan – Dec 2026</span>
        </div>
        <AreaChart data={chartSets[tab]} />
        <div className="flex justify-between mt-2 px-1">
          {months.map((m) => (
            <span key={m} className="text-[10px] text-[#1C2340]/35 font-medium">{m}</span>
          ))}
        </div>
      </div>

      {/* Bottom split: top products (progress list) + activity timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-6">
          <h2 className="text-sm font-bold text-[#1C2340] mb-5">Top Selling Products</h2>
          <div className="space-y-4">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[#1C2340] font-medium">
                    <span className="text-[#1C2340]/30 font-semibold mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {p.name}
                  </span>
                  <span className="text-xs text-[#1C2340]/50">{p.sales} sold</span>
                </div>
                <div className="h-1.5 bg-[#F4F5F7] rounded-[3px] overflow-hidden">
                  <div
                    className="h-full bg-[#5A5DF6] rounded-[3px]"
                    style={{ width: `${p.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-6">
          <h2 className="text-sm font-bold text-[#1C2340] mb-5">Recent Activity</h2>
          <div className="relative pl-2">
            <div className="absolute left-[19px] top-1 bottom-1 w-px bg-[#D9DDE5]" />
            <div className="space-y-5">
              {activity.map(({ text, time, icon: Icon, color }, i) => (
                <div key={i} className="flex gap-3 relative">
                  <div
                    className="w-9 h-9 rounded-[4px] flex items-center justify-center shrink-0 z-10 border border-white"
                    style={{ backgroundColor: `${color}1A` }}
                  >
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm text-[#1C2340]">{text}</p>
                    <p className="text-xs text-[#1C2340]/40 mt-0.5">{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
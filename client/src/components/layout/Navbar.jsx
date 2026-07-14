import React from 'react'
import { Search, Bell, HelpCircle } from 'lucide-react'

const Navbar = () => {
    return (
        <header className="h-[76px] bg-[#FFFFFF] border-b border-[#D9DDE5] flex items-center justify-between px-8 shadow-sm z-0">
            {/* Search Bar */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search size={18} className="text-[#1C2340] opacity-40 group-focus-within:text-[#5A5DF6] transition-colors" />
                </div>
                <input
                    type="text"
                    placeholder="Search campaigns, clients, or reports..."
                    className="block w-96 pl-10 pr-3 py-2.5 bg-[#F4F5F7] border border-[#D9DDE5] rounded-[4px] text-sm text-[#1C2340] placeholder-[#1C2340]/50 outline-none focus:bg-white focus:border-[#5A5DF6] focus:ring-2 focus:ring-[#5A5DF6]/20 transition-all shadow-sm"
                />
            </div>

            {/* Right Controls */}
            <div className="flex items-center space-x-5">
                <button className="text-[#1C2340]/60 hover:text-[#5A5DF6] transition-colors p-1">
                    <HelpCircle size={22} />
                </button>

                <button className="relative text-[#1C2340]/60 hover:text-[#1C2340] transition-colors p-1">
                    <Bell size={22} />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#E74C3C] border-2 border-white rounded-full"></span>
                </button>

                <div className="h-8 w-px bg-[#D9DDE5] mx-2"></div>

                {/* User Profile */}
                <div className="flex items-center gap-3 cursor-pointer group">
                    <div className="flex flex-col text-right">
                        <span className="text-sm font-semibold text-[#1C2340] group-hover:text-[#5A5DF6] transition-colors">Master Consultant</span>
                        <span className="text-xs font-medium text-[#1C2340]/50">Business Strategy</span>
                    </div>
                    <div className="w-10 h-10 bg-[#5A5DF6] border-2 border-[#D9DDE5] rounded-[4px] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        MC
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Navbar

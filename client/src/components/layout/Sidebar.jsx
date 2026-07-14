import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    PieChart,
    FileText,
    Settings,
    LogOut,
    Hexagon,
    Upload,
    CalculatorIcon,
} from 'lucide-react';

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Upload', icon: Upload, path: '/upload' },
    { name: 'Calculation', icon: CalculatorIcon, path: '/calculation' },
    { name: 'Reports', icon: FileText, path: '/reports' },
];

const Sidebar = () => {
    return (
        <div className="w-[260px] h-full bg-white border-r border-[#EAEBF3] flex flex-col">
            {/* Brand */}
            <div className="h-[76px] flex items-center px-6 border-b border-[#EAEBF3]">
                <div className="flex items-center justify-center bg-[#5A5DF6] text-white w-9 h-9 rounded-[6px] shadow-sm shadow-[#5A5DF6]/25">
                    <Hexagon size={20} fill="currentColor" />
                </div>
                <span className="ml-3 text-lg font-bold text-[#1C2340] tracking-wide">
                    CRASOME
                </span>
            </div>

            {/* Menu */}
            <div className="flex-1 overflow-y-auto py-5 px-4 space-y-1">
                <p className="px-3 text-[11px] font-semibold text-[#1C2340]/35 uppercase tracking-wider mb-3">
                    Main Menu
                </p>

                {navItems.map(({ name, icon: Icon, path }) => (
                    <NavLink
                        key={name}
                        to={path}
                        end={path === "/"}
                        className={({ isActive }) =>
                            `flex items-center px-3 py-2.5 rounded-[5px] font-medium text-sm transition-all ${isActive
                                ? 'bg-[#5A5DF6] text-white shadow-sm shadow-[#5A5DF6]/25'
                                : 'text-[#1C2340]/55 hover:bg-[#F5F5FC] hover:text-[#1C2340]'
                            }`
                        }
                    >
                        <Icon size={18} className="mr-3" />
                        {name}
                    </NavLink>
                ))}
            </div>

            {/* Bottom */}
            <div className="p-4 border-t border-[#EAEBF3] space-y-1">

                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex items-center px-3 py-2.5 rounded-[5px] transition-all ${isActive
                            ? 'bg-[#5A5DF6] text-white'
                            : 'text-[#1C2340]/55 hover:bg-[#F5F5FC] hover:text-[#1C2340]'
                        }`
                    }
                >
                    <Settings size={17} className="mr-3" />
                    <span className="font-medium text-sm">Settings</span>
                </NavLink>

                <NavLink
                    to="/logout"
                    className="flex items-center px-3 py-2.5 text-[#E74C3C] hover:bg-[#E74C3C]/8 rounded-[5px] transition-all"
                >
                    <LogOut size={17} className="mr-3" />
                    <span className="font-medium text-sm">Logout</span>
                </NavLink>

            </div>
        </div>
    );
};

export default Sidebar;
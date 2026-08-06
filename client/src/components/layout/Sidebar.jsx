import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    PieChart,
    FileText,
    Settings,
    LogOut,
    Hexagon,
    Upload,
    CalculatorIcon,
    Box,
} from 'lucide-react';

const navItems = [
    { name: 'Upload', icon: Upload, path: '/upload' },
    { name: 'Calculation', icon: CalculatorIcon, path: '/calculation' },
    { name: 'Stock', icon: Hexagon, path: '/stock' },
    { name: 'Boxes', icon: Box, path: '/boxes' },
];

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            logout();
            navigate('/login');
        }
    };
    return (
        <div className="w-[260px] h-full bg-white border-r border-[#EAEBF3] flex flex-col">
            {/* Brand */}
            <div className="h-[76px] flex items-center px-6 border-b border-[#EAEBF3]">
                <img src="/crasome-logo.jpg" alt="Crasome Logo" className="h-10 object-contain" />
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

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 py-2.5 text-[#E74C3C] hover:bg-[#E74C3C]/8 rounded-[5px] transition-all"
                >
                    <LogOut size={17} className="mr-3" />
                    <span className="font-medium text-sm">Logout</span>
                </button>

            </div>
        </div>
    );
};

export default Sidebar;
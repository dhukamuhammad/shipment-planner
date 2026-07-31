import React from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

const Layout = ({ children }) => {
    return (
        <div className="flex h-screen w-full bg-[#F5F5FC] overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 w-full h-full">
                {/* <Navbar /> */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F5FC] p-8">
                    <div className="mx-auto">{children}</div>
                </main>
            </div>
        </div>
    )
}

export default Layout
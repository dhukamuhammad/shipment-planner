import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Dashboard from '../../pages/dashboard/Dashboard'
import Layout from '../../components/layout/Layout'

const DashboardRoute = () => {
    return (
        <Routes>
            <Route
                path="/dashboard"
                element={
                    <Layout>
                        <Dashboard />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default DashboardRoute

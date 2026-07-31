import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Stock from '../../pages/stock/Stock'

const StockRoute = () => {
    return (
        <Routes>
            <Route
                path="/stock"
                element={
                    <Layout>
                        <Stock />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default StockRoute 

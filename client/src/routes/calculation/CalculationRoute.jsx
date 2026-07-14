import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Calculation from '../../pages/calculation/Calculation'

const CalculationRoute = () => {
    return (
        <Routes>
            <Route
                path="/calculation"
                element={
                    <Layout>
                        <Calculation />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default CalculationRoute 

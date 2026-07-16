import React from 'react'
import DashboardRoute from './dashboard/DashboardRoute'
import UploadRoute from './upload/UploadRoute'
import CalculationRoute from './calculation/CalculationRoute'
import ManifestRoute from './manifest/ManifestRoute'
import StockRoute from './stock/StockRoute'

const MainRoute = () => {
    return (
        <>
            <DashboardRoute />
            <UploadRoute />
            <CalculationRoute />
            <ManifestRoute />
            <StockRoute />
        </>
    )
}

export default MainRoute
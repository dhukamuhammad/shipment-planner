import React from 'react'
import DashboardRoute from './dashboard/DashboardRoute'
import UploadRoute from './upload/UploadRoute'
import CalculationRoute from './calculation/CalculationRoute'
import ManifestRoute from './manifest/ManifestRoute'
import StockRoute from './stock/StockRoute'
import BoxesRoute from './boxes/BoxesRoute'

const MainRoute = () => {
    return (
        <>
            <DashboardRoute />
            <UploadRoute />
            <CalculationRoute />
            <ManifestRoute />
            <StockRoute />
            <BoxesRoute />
        </>
    )
}

export default MainRoute
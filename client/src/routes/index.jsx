import React from 'react'
import DashboardRoute from './dashboard/DashboardRoute'
import UploadRoute from './upload/UploadRoute'
import CalculationRoute from './calculation/CalculationRoute'

const MainRoute = () => {
    return (
        <>
            <DashboardRoute />
            <UploadRoute />
            <CalculationRoute />
        </>
    )
}

export default MainRoute
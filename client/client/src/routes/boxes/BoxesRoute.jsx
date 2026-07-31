import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Boxes from '../../pages/boxes/Boxes'

const BoxesRoute = () => {
    return (
        <Routes>
            <Route
                path="/boxes"
                element={
                    <Layout>
                        <Boxes />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default BoxesRoute;

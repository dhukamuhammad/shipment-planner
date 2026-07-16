import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Manifest from '../../pages/manifest/Manifest'

const ManifestRoute = () => {
    return (
        <Routes>
            <Route
                path="/manifest"
                element={
                    <Layout>
                        <Manifest />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default ManifestRoute 

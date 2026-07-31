import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Settings from '../../pages/settings/Settings'

const SettingsRoute = () => {
    return (
        <Routes>
            <Route
                path="/settings"
                element={
                    <Layout>
                        <Settings />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default SettingsRoute 

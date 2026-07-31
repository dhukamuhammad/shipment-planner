import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Upload from '../../pages/upload/Upload'

const UploadRoute = () => {
    return (
        <Routes>
            <Route
                path="/upload"
                element={
                    <Layout>
                        <Upload />
                    </Layout>
                }
            />
        </Routes>
    )
}

export default UploadRoute

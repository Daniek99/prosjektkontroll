import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SubcontractorProvider } from './contexts/SubcontractorContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Prosjektoppsett from './pages/Prosjektoppsett';
import Subcontractors from './pages/Subcontractors';
import Progress from './pages/Progress';
import Financials from './pages/Financials';
import Bemanning from './pages/Bemanning';
import Risks from './pages/Risks';
import Contracts from './pages/Contracts';
import Areas from './pages/Areas';
import Decisions from './pages/Decisions';
import Diary from './pages/Diary';
import Contacts from './pages/Contacts';
import Statistics from './pages/Statistics';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <AuthProvider>
          <SubcontractorProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/setup" element={<Prosjektoppsett />} />
                  <Route path="/subcontractors" element={<Subcontractors />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/financials" element={<Financials />} />
                  <Route path="/bemanning" element={<Bemanning />} />
                  <Route path="/risks" element={<Risks />} />
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/areas" element={<Areas />} />
                  <Route path="/decisions" element={<Decisions />} />
                  <Route path="/diary" element={<Diary />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </SubcontractorProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SubcontractorProvider } from './contexts/SubcontractorContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { RequireDataset, RequireMaster } from './components/RouteGuards';
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
import UserManagement from './pages/UserManagement';

function App() {
  // Fallback is baked in so the production build works on Heroku without
  // requiring VITE_GOOGLE_CLIENT_ID to be injected via `heroku config:set`.
  const FALLBACK_GOOGLE_CLIENT_ID = '175309449361-namu4a3oqg9obknu1q70fji38bktanbl.apps.googleusercontent.com';
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || FALLBACK_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <AuthProvider>
          <ProjectProvider>
            <SubcontractorProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<RequireDataset dataset="dashboard"><Dashboard /></RequireDataset>} />
                    <Route path="/setup" element={<RequireDataset dataset="setup"><Prosjektoppsett /></RequireDataset>} />
                    <Route path="/subcontractors" element={<RequireDataset dataset="subcontractors"><Subcontractors /></RequireDataset>} />
                    <Route path="/progress" element={<RequireDataset dataset="progress"><Progress /></RequireDataset>} />
                    <Route path="/financials" element={<RequireDataset dataset="financials"><Financials /></RequireDataset>} />
                    <Route path="/bemanning" element={<RequireDataset dataset="bemanning"><Bemanning /></RequireDataset>} />
                    <Route path="/risks" element={<RequireDataset dataset="risks"><Risks /></RequireDataset>} />
                    <Route path="/contracts" element={<RequireDataset dataset="contracts"><Contracts /></RequireDataset>} />
                    <Route path="/areas" element={<RequireDataset dataset="areas"><Areas /></RequireDataset>} />
                    <Route path="/decisions" element={<RequireDataset dataset="decisions"><Decisions /></RequireDataset>} />
                    <Route path="/diary" element={<RequireDataset dataset="diary"><Diary /></RequireDataset>} />
                    <Route path="/contacts" element={<RequireDataset dataset="contacts"><Contacts /></RequireDataset>} />
                    <Route path="/statistics" element={<RequireDataset dataset="statistics"><Statistics /></RequireDataset>} />
                    <Route path="/admin" element={<RequireMaster><UserManagement /></RequireMaster>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </SubcontractorProvider>
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
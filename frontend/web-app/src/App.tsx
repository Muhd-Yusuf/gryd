
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordOTPPage from './pages/ResetPasswordOTPPage';
import CreateNewPasswordPage from './pages/CreateNewPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import BusinessSetupPage from './pages/BusinessSetupPage';
import PasswordPage from './pages/PasswordPage';
import AIVoiceSetupPage from './pages/AIVoiceSetupPage';
import DashboardPage from './pages/DashboardPage';
import PropertiesPage from './pages/PropertiesPage';
import PropertiesNewPage from './pages/PropertiesNewPage';
import PropertiesGeneratingPage from './pages/PropertiesGeneratingPage';
import PropertiesEditorPage from './pages/PropertiesEditorPage';
import CommunityPage from './pages/CommunityPage';
import SubgridAdminPage from './pages/SubgridAdminPage';
import CrmLeadsPage from './pages/CrmLeadsPage';
import CrmPipelinePage from './pages/CrmPipelinePage';
import CrmTasksPage from './pages/CrmTasksPage';
import CrmCampaignsPage from './pages/CrmCampaignsPage';
import CrmReportsPage from './pages/CrmReportsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/signup/verify" element={<VerifyEmailPage />} />
                <Route path="/signup/password" element={<PasswordPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/otp" element={<ResetPasswordOTPPage />} />
                <Route path="/reset-password/new" element={<CreateNewPasswordPage />} />
                <Route path="/signup/business" element={<BusinessSetupPage />} />
                <Route path="/signup/ai-voice" element={<AIVoiceSetupPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/properties/new" element={<PropertiesNewPage />} />
                <Route path="/properties/generating" element={<PropertiesGeneratingPage />} />
                <Route path="/properties/editor" element={<PropertiesEditorPage />} />
                <Route path="/crm/leads" element={<CrmLeadsPage />} />
                <Route path="/crm/pipeline" element={<CrmPipelinePage />} />
                <Route path="/crm/tasks" element={<CrmTasksPage />} />
                <Route path="/crm/campaigns" element={<CrmCampaignsPage />} />
                <Route path="/crm/reports" element={<CrmReportsPage />} />
                <Route path="/community" element={<CommunityPage />} />
                <Route path="/community/admin" element={<SubgridAdminPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

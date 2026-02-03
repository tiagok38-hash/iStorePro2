import React, { useState, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import TopBar from './components/TopBar.tsx';
import { ToastProvider } from './contexts/ToastContext.tsx';
import { UserProvider } from './contexts/UserContext.tsx';
import { SpinnerIcon } from './components/icons.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import AuthLayout from './components/AuthLayout.tsx';
import { OnlineStatusIndicator, SuspenseFallback } from './components/GlobalLoading.tsx';
import BottomNav from './components/BottomNav.tsx';

const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Products = lazy(() => import('./pages/Products.tsx'));
const Customers = lazy(() => import('./pages/Customers.tsx'));
const POS = lazy(() => import('./pages/POS.tsx'));
const Reports = lazy(() => import('./pages/Reports.tsx'));
const Company = lazy(() => import('./pages/Company.tsx'));
const Vendas = lazy(() => import('./pages/Vendas.tsx'));
const Login = lazy(() => import('./pages/Login.tsx'));


const MainLayout: React.FC = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const location = useLocation();

    const toggleSidebarCollapse = () => {
        setIsSidebarCollapsed(prev => !prev);
    };

    return (
        <div className="flex bg-background text-primary min-h-screen">
            <Sidebar
                isOpen={isSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={toggleSidebarCollapse}
                onCloseSidebar={() => setSidebarOpen(false)}
            />



            <div className="flex-1 flex flex-col w-full min-w-0 pb-20 lg:pb-0">
                <Header onMenuClick={() => { }} />
                <TopBar />
                <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
                    <Suspense fallback={<SuspenseFallback />}>
                        <div key={location.pathname} className="animate-fade-in h-full">
                            <Outlet />
                        </div>
                    </Suspense>
                </main>
            </div>
            <BottomNav />
        </div>
    );
}

const App: React.FC = () => {
    return (
        <ToastProvider>
            <UserProvider>
                <Router>
                    <Suspense fallback={<SuspenseFallback fullScreen />}>
                        <Routes>
                            {/* Public Auth Routes */}
                            <Route element={<AuthLayout />}>
                                <Route path="/login" element={<Login />} />
                                {/* Registro bloqueado - redireciona para login */}
                                <Route path="/register" element={<Login />} />
                            </Route>

                            {/* Protected App Routes */}
                            <Route element={<ProtectedRoute />}>
                                <Route element={<MainLayout />}>
                                    <Route element={<ProtectedRoute permissionKey="canAccessDashboard" />}>
                                        <Route path="/" element={<Dashboard />} />
                                    </Route>
                                    <Route element={<ProtectedRoute permissionKey="canAccessEstoque" />}>
                                        <Route path="/products" element={<Products />} />
                                    </Route>
                                    <Route element={<ProtectedRoute permissionKey="canAccessClientes" />}>
                                        <Route path="/customers" element={<Customers />} />
                                    </Route>
                                    <Route element={<ProtectedRoute permissionKey="canAccessVendas" />}>
                                        <Route path="/vendas" element={<Vendas />} />
                                    </Route>
                                    <Route element={<ProtectedRoute permissionKey="canAccessRelatorios" />}>
                                        <Route path="/reports" element={<Reports />} />
                                    </Route>
                                    <Route element={<ProtectedRoute permissionKey={["canAccessEmpresa", "canEditOwnProfile", "canManageMarcasECategorias"]} />}>
                                        <Route path="/company" element={<Company />} />
                                    </Route>
                                </Route>
                                <Route element={<ProtectedRoute permissionKey="canAccessPOS" />}>
                                    <Route path="/pos" element={<POS />} />
                                </Route>
                            </Route>
                        </Routes>
                    </Suspense>
                    {/* Global Online/Offline Status Indicator */}
                    <OnlineStatusIndicator />
                </Router>
            </UserProvider>
        </ToastProvider>
    );
};

export default App;
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
const ServiceOrderLayout = lazy(() => import('./pages/ServiceOrders/ServiceOrderLayout.tsx'));
const ServiceOrderDashboard = lazy(() => import('./pages/ServiceOrders/ServiceOrderDashboard.tsx'));
const ServiceOrderList = lazy(() => import('./pages/ServiceOrders/ServiceOrderList.tsx'));
const ServiceOrderForm = lazy(() => import('./pages/ServiceOrders/ServiceOrderForm.tsx'));
const ServiceOrderProducts = lazy(() => import('./pages/ServiceOrders/ServiceOrderProducts.tsx'));
const ServiceOrderCustomers = lazy(() => import('./pages/ServiceOrders/ServiceOrderCustomers.tsx'));
const ServiceOrderSettings = lazy(() => import('./pages/ServiceOrders/ServiceOrderSettings.tsx'));
const ServiceOrderFinancial = lazy(() => import('./pages/ServiceOrders/ServiceOrderFinancial.tsx'));
const ServiceOrderReports = lazy(() => import('./pages/ServiceOrders/ServiceOrderReports.tsx'));
const CatalogLayout = lazy(() => import('./pages/Catalog/CatalogLayout.tsx'));
const CatalogAdmin = lazy(() => import('./pages/Catalog/CatalogAdmin.tsx'));
const CatalogSettings = lazy(() => import('./pages/Catalog/CatalogSettings.tsx'));
const CatalogPublic = lazy(() => import('./pages/Catalog/CatalogPublic.tsx'));
const Financeiro = lazy(() => import('./pages/Financeiro.tsx'));


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



            <div className="flex-1 flex flex-col w-full min-w-0 pb-[calc(env(safe-area-inset-bottom)+70px)] lg:pb-0">
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
                                    <Route element={<ProtectedRoute permissionKey="canAccessFinanceiro" />}>
                                        <Route path="/financeiro" element={<Financeiro />} />
                                    </Route>
                                </Route>
                                <Route element={<ProtectedRoute permissionKey="canAccessPOS" />}>
                                    <Route path="/pos" element={<POS />} />
                                </Route>

                                {/* Service Order Module (Immersive) */}
                                <Route element={<ProtectedRoute permissionKey="canAccessDashboard" />}>
                                    <Route path="/service-orders" element={<ServiceOrderLayout />}>
                                        <Route index element={<ServiceOrderDashboard />} />
                                        <Route path="list" element={<ServiceOrderList />} />
                                        <Route path="new" element={<ServiceOrderForm />} />
                                        <Route path="edit/:id" element={<ServiceOrderForm />} />
                                        <Route path="products" element={<ServiceOrderProducts />} />
                                        <Route path="customers" element={<ServiceOrderCustomers />} />
                                        <Route path="financial" element={<ServiceOrderFinancial />} />
                                        <Route path="reports" element={<ServiceOrderReports />} />
                                        <Route path="settings" element={<ServiceOrderSettings />} />
                                    </Route>
                                </Route>

                                {/* Catalog Module (Immersive) */}
                                <Route element={<ProtectedRoute permissionKey="canAccessDashboard" />}>
                                    <Route path="/catalog" element={<CatalogLayout />}>
                                        <Route index element={<CatalogAdmin />} />
                                        <Route path="settings" element={<CatalogSettings />} />
                                    </Route>
                                </Route>
                            </Route>

                            {/* Public Catalog (No Auth Required) */}
                            <Route path="/catalogo/:slug" element={<CatalogPublic />} />
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
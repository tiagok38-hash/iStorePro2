
// --- Shared infrastructure (imported from dedicated modules) ---
import { fetchWithCache, clearCache, getAllCacheKeys, fetchWithRetry, withTimeout, CACHE_TTL, METADATA_TTL } from './cacheUtils.ts';
export { clearCache } from './cacheUtils.ts';

// --- Formatters ---
import { formatCurrency, formatPhone } from '../utils/formatters.ts';
export { formatCurrency, formatPhone };

// --- Auth, Users, Permissions ---
import { resolvePermissions, login, logout, getProfile, getUsers, addUser, updateUser, deleteUser, registerAdmin, checkAdminExists, getPermissionProfiles, addPermissionProfile, updatePermissionProfile, deletePermissionProfile, sendPasswordResetEmail, updatePassword, resendConfirmationEmail } from './authService.ts';
export { login, logout, getProfile, getUsers, addUser, updateUser, deleteUser, registerAdmin, checkAdminExists, getPermissionProfiles, addPermissionProfile, updatePermissionProfile, deletePermissionProfile, sendPasswordResetEmail, updatePassword, resendConfirmationEmail };

// --- Audit ---
import { addAuditLog, getAuditLogs, getBulkUpdateLogs, getCashRegisterAuditLogs } from './auditService.ts';
export { addAuditLog, getAuditLogs, getBulkUpdateLogs, getCashRegisterAuditLogs };

// --- Delegated service modules ---
export * from './productService.ts';
export * from './salesService.ts';
export * from './cashSessionService.ts';
export * from './customerService.ts';
export * from './supplierService.ts';
export * from './purchaseOrderService.ts';
export * from './serviceOrderService.ts';
export * from './catalogService.ts';
export * from './backupService.ts';
export * from './parametersService.ts';
export * from './companyService.ts';
export * from './financialService.ts';
export * from './crmService.ts';
export * from './creditService.ts';
export * from './inventoryService.ts';
export * from './bancoHorasService.ts';
export * from './osPartsService.ts';
export * from './customerDeviceService.ts';

// --- Circular dependency injection ---
import { setSyncCustomerCreditLimit } from './creditService.ts';
import { syncCustomerCreditLimit } from './customerService.ts';
setSyncCustomerCreditLimit(syncCustomerCreditLimit);


import React from 'react';
import {
    LayoutGrid,
    Package,
    Banknote,
    Store,
    Users,
    BarChart3,
    Building2,
    Tag,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    UserCircle,
    LogOut,
    Pencil,
    Trash2,
    Search,
    Barcode,
    Plus,
    Minus,
    X,
    Check,
    Home,
    Loader2,
    Smartphone,
    CreditCard,
    DollarSign,
    Ticket,
    FileText,
    Printer,
    MoreVertical,
    Settings,
    Menu,
    Clock,
    Bell,
    Eye,
    EyeOff,
    ArrowUpDown,
    Lock,
    UserPlus,
    RefreshCcw,
    Volume2,
    Clipboard,
    Image as ImageIcon,
    Camera,
    PlayCircle,
    ShoppingCart,
    Calculator,
    Undo,
    Upload,
    XCircle,
    CheckCircle2,
    AlertTriangle,
    Info,
    ArrowRightCircle,
    Sliders,
    Cake,
    Calendar,
    RefreshCw,
    Divide,
    User,
    Instagram,
    Trophy,
    MapPin,
    Zap,
    Monitor,
    Server,
    Sparkles
} from 'lucide-react';

/**
 * Premium Icon System based on Lucide
 * Standardized to 24px, Outline only, Consistent Stroke Width
 */

const ICON_SIZE = 24;
const STROKE_WIDTH = 1.5;

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    strokeWidth?: number;
    className?: string;
}

const wrapIcon = (LucideIcon: any) => {
    return ({ size = ICON_SIZE, strokeWidth = STROKE_WIDTH, className = "", ...props }: IconProps) => (
        <LucideIcon
            size={size}
            strokeWidth={strokeWidth}
            className={className}
            {...props}
        />
    );
};

// --- Exported Icons ---

export const Squares2x2Icon = wrapIcon(LayoutGrid);
export const ArchiveBoxIcon = wrapIcon(Package);
export const BanknotesIcon = wrapIcon(Banknote);
export const CashRegisterIcon = wrapIcon(Store);
export const UsersIcon = wrapIcon(Users);
export const ChartBarIcon = wrapIcon(BarChart3);
export const BuildingOffice2Icon = wrapIcon(Building2);
export const TagIcon = wrapIcon(Tag);
export const UserGroupIcon = wrapIcon(Users);
export const LogoIcon = wrapIcon(Sparkles);
export const CubeIcon = wrapIcon(Package);

export const ChevronLeftIcon = wrapIcon(ChevronLeft);
export const ChevronRightIcon = wrapIcon(ChevronRight);
export const ChevronDownIcon = wrapIcon(ChevronDown);
export const UserCircleIcon = wrapIcon(UserCircle);
export const LogoutIcon = wrapIcon(LogOut);
export const EditIcon = wrapIcon(Pencil);
export const TrashIcon = wrapIcon(Trash2);
export const SearchIcon = wrapIcon(Search);
export const BarcodeIcon = wrapIcon(Barcode);
export const PlusIcon = wrapIcon(Plus);
export const MinusIcon = wrapIcon(Minus);
export const CloseIcon = wrapIcon(X);
export const CheckIcon = wrapIcon(Check);
export const HomeIcon = wrapIcon(Home);

export const SpinnerIcon = ({ size = 40, className = '', ...props }: IconProps) => (
    <Loader2 size={size} className={`animate-spin text-primary ${className}`} {...props} />
);

// Special Icons (Logos/Brand) - Manually crafted to match Lucide style (1.5 stroke, outline)
export const AppleIcon = ({ className = '', ...props }: IconProps) => (
    <svg
        width={props.size || ICON_SIZE}
        height={props.size || ICON_SIZE}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        {...props}
    >
        <path d="M17.062 10.222c.01 2.016 1.644 2.99 1.666 3.003-.01.03-.258.913-.87 1.792-.525.758-1.07 1.516-1.916 1.54-.844.026-1.114-.492-2.076-.492-.962 0-1.255.474-2.065.5-.81.026-1.428-1.01-1.966-1.78-1.1-1.583-1.923-4.571-.462-7.052.724-1.233 1.99-2.012 3.348-2.031 1.031-.013 2.004.706 2.634.706.63 0 1.795-.85 3.019-.72.51.02 1.956.206 2.883 1.564-.075.045-1.722.998-1.7 3.013zM14.954 4.922c.459-.556.77-1.332.684-2.106-.658.026-1.464.44-1.936.992-.43.5-.8 1.28-.7 2.04.735.056 1.493-.37 1.952-.926z" />
    </svg>
);

export const PixIcon = ({ className = '', ...props }: IconProps) => (
    <svg
        width={props.size || ICON_SIZE}
        height={props.size || ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={props.strokeWidth || STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        <path d="M12 3L4 11L12 19L20 11L12 3Z" />
        <path d="M8 11L12 15L16 11L12 7L8 11Z" />
    </svg>
);

export const WhatsAppIcon = ({ className = '', ...props }: IconProps) => (
    <svg
        width={props.size || ICON_SIZE}
        height={props.size || ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={props.strokeWidth || STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-12.7 8.38 8.38 0 0 1 3.8.9L21 2z" />
        <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1zm6 0a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1z" />
        <path d="M9 14.5s1.5 1 3 1 3-1 3-1" />
    </svg>
);

export const SmartphoneIcon = wrapIcon(Smartphone);
export const CreditCardIcon = wrapIcon(CreditCard);
export const CurrencyDollarIcon = wrapIcon(DollarSign);
export const TicketIcon = wrapIcon(Ticket);
export const DocumentTextIcon = wrapIcon(FileText);
export const PrinterIcon = wrapIcon(Printer);
export const EllipsisVerticalIcon = wrapIcon(MoreVertical);
export const Cog6ToothIcon = wrapIcon(Settings);
export const MenuIcon = wrapIcon(Menu);
export const ClockIcon = wrapIcon(Clock);
export const BellIcon = wrapIcon(Bell);
export const EyeIcon = wrapIcon(Eye);
export const EyeSlashIcon = wrapIcon(EyeOff);
export const ArrowsUpDownIcon = wrapIcon(ArrowUpDown);
export const LockClosedIcon = wrapIcon(Lock);
export const UserPlusIcon = wrapIcon(UserPlus);
export const ArrowPathRoundedSquareIcon = wrapIcon(RefreshCcw);
export const SpeakerWaveIcon = wrapIcon(Volume2);
export const ClipboardDocumentIcon = wrapIcon(Clipboard);
export const PhotographIcon = wrapIcon(ImageIcon);
export const CameraIcon = wrapIcon(Camera);
export const PlayCircleIcon = wrapIcon(PlayCircle);
export const ShoppingCartIcon = wrapIcon(ShoppingCart);
export const ShoppingCartPlusIcon = wrapIcon(ShoppingCart); // Lucide doesn't have a specific ShoppingCartPlus, using ShoppingCart
export const CalculatorIcon = wrapIcon(Calculator);
export const ArrowUturnLeftIcon = wrapIcon(Undo);
export const DocumentArrowUpIcon = wrapIcon(Upload);
export const XCircleIcon = wrapIcon(XCircle);
export const SuccessIcon = wrapIcon(CheckCircle2);
export const ErrorIcon = wrapIcon(AlertTriangle);
export const InfoIcon = wrapIcon(Info);
export const ArrowRightCircleIcon = wrapIcon(ArrowRightCircle);
export const AdjustmentsHorizontalIcon = wrapIcon(Sliders);
export const BirthdayCakeIcon = wrapIcon(Cake);
export const CalendarDaysIcon = wrapIcon(Calendar);

export const CashIcon = wrapIcon(Banknote);
export const DeviceExchangeIcon = wrapIcon(RefreshCw);
export const InstallmentIcon = wrapIcon(Divide);
export const BoxIsoIcon = wrapIcon(Package);
export const BoxIsoFilledIcon = wrapIcon(Package);
export const UserIcon = wrapIcon(User);
export const InstagramIcon = wrapIcon(Instagram);
export const TrophyIcon = wrapIcon(Trophy);
export const MapPinIcon = wrapIcon(MapPin);
export const BoltIcon = wrapIcon(Zap);
export const ComputerDesktopIcon = wrapIcon(Monitor);
export const ServerStackIcon = wrapIcon(Server);

const Icon = (props: any) => <div {...props} />;
export default Icon;


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
    Sparkles,
    MessageCircle,
    MessageSquare,
    Files
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
        fill="currentColor"
        className={`text-green-500 ${className}`}
        {...props}
    >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c.01 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.04s.88 2.37 1.01 2.53c.12.17 1.73 2.64 4.2 3.7.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.27z" />
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
export const MessageCircleIcon = wrapIcon(MessageCircle);
export const MessageSquareIcon = wrapIcon(MessageSquare);
export const DocumentDuplicateIcon = wrapIcon(Files);

export const CashIcon = wrapIcon(Banknote);
export const DeviceExchangeIcon = wrapIcon(RefreshCw);
export const InstallmentIcon = wrapIcon(Divide);
export const BoxIsoIcon = wrapIcon(Package);
export const BoxIsoFilledIcon = wrapIcon(Package);
export const UserIcon = wrapIcon(User);
export const InstagramIcon = ({ className = '', ...props }: IconProps) => (
    <Instagram
        size={props.size || ICON_SIZE}
        strokeWidth={props.strokeWidth || STROKE_WIDTH}
        className={`text-rose-500 ${className}`}
        {...props}
    />
);
export const TrophyIcon = wrapIcon(Trophy);
export const MapPinIcon = wrapIcon(MapPin);
export const BoltIcon = wrapIcon(Zap);
export const ComputerDesktopIcon = wrapIcon(Monitor);
export const ServerStackIcon = wrapIcon(Server);

const Icon = (props: any) => <div {...props} />;
export default Icon;

import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

/**
 * The OEM power managers that stop reminders from firing.
 *
 * Stock Android is not the whole story on a Tecno, Infinix or itel. Those are
 * Transsion phones running HiOS/XOS, and they ship a second, vendor-written
 * power manager — Phone Master — that sits above the AOSP one. It defaults
 * third-party apps to auto-start OFF, and an app in that state gets
 * *force-stopped* rather than merely backgrounded. A force-stop is not a pause:
 * Android cancels every alarm the app registered with AlarmManager and does not
 * put them back. expo-notifications schedules each reminder as exactly such an
 * alarm, so one sweep by Phone Master silently retires the whole schedule.
 *
 * The AOSP battery-optimisation whitelist that `battery-optimization.tsx` asks
 * for does not cover this — a user can be whitelisted there and still be
 * force-stopped by Phone Master. The only cure is the vendor's own auto-start
 * screen, which has no public API and no permission to request: it has to be
 * opened by its component name and toggled by hand.
 *
 * The component names below are the ones these vendors ship. They move between
 * firmware versions, so each family lists its candidates in order and
 * `openAutoStartSettings` walks them until one opens — an explicit component
 * that does not exist throws ActivityNotFoundException, which is the signal to
 * try the next. If none open we fall back to the app's own settings page, which
 * always exists.
 */

const PACKAGE = 'com.asaro.meditation';

export type OemFamily = 'transsion' | 'xiaomi' | 'huawei' | 'oppo' | 'vivo' | 'samsung' | 'none';

type Component = { packageName: string; className: string };

const FAMILIES: { family: Exclude<OemFamily, 'none'>; matches: string[]; components: Component[] }[] = [
    {
        family: 'transsion',
        // Transsion sells under three brands; the manufacturer string is the
        // brand, not "Transsion", so all three have to be matched.
        matches: ['tecno', 'infinix', 'itel', 'transsion'],
        components: [
            { packageName: 'com.transsion.phonemaster', className: 'com.cyin.himgr.autostart.AutoStartActivity' },
            { packageName: 'com.transsion.phonemaster', className: 'com.transsion.phonemaster.autostart.AutoStartActivity' },
            { packageName: 'com.transsion.phonemanager', className: 'com.itel.autobootmanager.activity.AutoBootMgrActivity' },
        ],
    },
    {
        family: 'xiaomi',
        matches: ['xiaomi', 'redmi', 'poco'],
        components: [
            { packageName: 'com.miui.securitycenter', className: 'com.miui.permcenter.autostart.AutoStartManagementActivity' },
        ],
    },
    {
        family: 'huawei',
        matches: ['huawei', 'honor'],
        components: [
            { packageName: 'com.huawei.systemmanager', className: 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity' },
            { packageName: 'com.huawei.systemmanager', className: 'com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity' },
        ],
    },
    {
        family: 'oppo',
        matches: ['oppo', 'realme', 'oneplus'],
        components: [
            { packageName: 'com.coloros.safecenter', className: 'com.coloros.safecenter.permission.startup.StartupAppListActivity' },
            { packageName: 'com.coloros.safecenter', className: 'com.coloros.safecenter.startupapp.StartupAppListActivity' },
            { packageName: 'com.oppo.safe', className: 'com.oppo.safe.permission.startup.StartupAppListActivity' },
        ],
    },
    {
        family: 'vivo',
        matches: ['vivo'],
        components: [
            { packageName: 'com.vivo.permissionmanager', className: 'com.vivo.permissionmanager.activity.BgStartUpManagerActivity' },
            { packageName: 'com.iqoo.secure', className: 'com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity' },
        ],
    },
    {
        family: 'samsung',
        matches: ['samsung'],
        components: [
            { packageName: 'com.samsung.android.lool', className: 'com.samsung.android.sm.ui.battery.BatteryActivity' },
        ],
    },
];

/** Which vendor power manager, if any, is standing between us and the alarm. */
export function detectOemFamily(): OemFamily {
    if (Platform.OS !== 'android') return 'none';

    const fingerprint = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
    for (const entry of FAMILIES) {
        if (entry.matches.some(needle => fingerprint.includes(needle))) return entry.family;
    }
    return 'none';
}

/**
 * True when this phone has a vendor auto-start list that the AOSP battery
 * whitelist does not cover, so the user has to be walked through it as well.
 */
export function needsOemAutoStartStep(): boolean {
    return detectOemFamily() !== 'none';
}

/** A human name for the vendor's tool, for copy that has to tell the user where to go. */
export function oemAutoStartLabel(): string {
    switch (detectOemFamily()) {
        case 'transsion': return 'Phone Master';
        case 'xiaomi': return 'Security';
        case 'huawei': return 'Phone Manager';
        case 'oppo': return 'Phone Manager';
        case 'vivo': return 'i Manager';
        case 'samsung': return 'Device Care';
        default: return 'Settings';
    }
}

/**
 * Open the vendor's auto-start list, falling back to this app's settings page.
 *
 * Resolves `true` when a vendor screen opened, `false` when we had to fall
 * back — the caller uses that to decide how much hand-holding the copy needs.
 */
export async function openAutoStartSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const family = detectOemFamily();
    const components = FAMILIES.find(entry => entry.family === family)?.components ?? [];

    for (const component of components) {
        try {
            await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
                packageName: component.packageName,
                className: component.className,
            });
            return true;
        } catch {
            // This firmware doesn't ship that component. Try the next spelling.
        }
    }

    try {
        await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
            { data: `package:${PACKAGE}` },
        );
    } catch {
        Linking.openSettings();
    }
    return false;
}

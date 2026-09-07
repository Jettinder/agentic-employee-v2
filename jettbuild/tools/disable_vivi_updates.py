#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'vivi')
p=root/'app/src/main/kotlin/com/music/vivi/vivimusic/updater/vivimusicupdater.kt';s=p.read_text()
s=s.replace('''fun getUpdateAvailableState(context: Context): Boolean {\n    val sharedPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)\n    return sharedPrefs.getBoolean(KEY_UPDATE_AVAILABLE, false)\n}''','''fun getUpdateAvailableState(context: Context): Boolean = false''')
s=s.replace('''fun getAutoUpdateCheckSetting(context: Context): Boolean {\n    val sharedPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)\n    return sharedPrefs.getBoolean(KEY_AUTO_UPDATE_CHECK, true)\n}''','''fun getAutoUpdateCheckSetting(context: Context): Boolean = false''')
needle=''' ) {\n    withContext(Dispatchers.IO) {'''.replace(' )',')')
# Locate the exact checkForUpdate body rather than any other suspend function.
start=s.find('suspend fun checkForUpdate(')
if start<0:raise SystemExit('checkForUpdate not found')
body=s.find(') {',start)
if body<0:raise SystemExit('checkForUpdate body not found')
insert='''\n    onSuccess(BuildConfig.VERSION_NAME, false, emptyList(), "", "", null, null, null)\n    return\n    @Suppress("UNREACHABLE_CODE")'''
s=s[:body+3]+insert+s[body+3:]
p.write_text(s)
for rel,old in [('app/src/main/kotlin/com/music/vivi/MainActivity.kt','if (getAutoUpdateCheckSetting(context)) {'),('app/src/main/kotlin/com/music/vivi/ui/screens/settings/SettingsScreen.kt','if (autoUpdateSetting) {'),('app/src/main/kotlin/com/music/vivi/ui/screens/settings/UpdateSettings.kt','if (autoUpdateEnabled) {')]:
 f=root/rel
 if f.exists():f.write_text(f.read_text().replace(old,'if (false) { // Jettmusic OTA disabled'))
print('Vivi updater disabled')

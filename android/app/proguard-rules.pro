# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# expo-notifications
-keep class expo.modules.notifications.** { *; }
-keep class com.google.firebase.** { *; }

# Keep notification handler and related classes
-keep class * extends expo.modules.notifications.notifications.interfaces.NotificationHandler { *; }
-keep class * implements expo.modules.notifications.notifications.interfaces.NotificationHandler { *; }
-keep class * extends expo.modules.notifications.notifications.presentation.builders.NotificationBuilder { *; }
-keep class * implements expo.modules.notifications.notifications.presentation.builders.NotificationBuilder { *; }

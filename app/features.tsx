import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const COLOR = "rgb(162, 132, 94)"; // shared app color

const UpcomingFeatures = () => {
    const features = [
        {
            title: "Easier Verse Selection",
            description:
                "Better navigation and verse picking so you don't have to scroll forever to find what you're looking for.",
        },
        {
            title: "Quick Reflections",
            description:
                "Add your thoughts with fewer taps. No more going through multiple screens just to jot down a quick note.",
        },
        {
            title: "Custom Questions",
            description:
                "Create your own reflection questions instead of being stuck with generic ones that don't fit your study style.",
        },
        {
            title: "Smart Reminders",
            description:
                "Notifications that actually help instead of just bothering you. Set reminders for things you want to study deeper.",
        },
        {
            title: "Better Than Streaks",
            description:
                "Track your progress in a way that actually matters, not just consecutive days that make you feel bad when you miss one.",
        },
        {
            title: "Timeline View",
            description:
                "See your study journey over time. Look back at what you've learned and how you've grown.",
        },
        {
            title: "One-Tap Continue",
            description:
                "Jump right back to where you stopped reading. No hunting around to find your place.",
        },
        {
            title: "Study Notes Field",
            description:
                "Write down what you want to dig into later and set reminders so you don't forget.",
        },
        {
            title: "Filter Past Entries",
            description:
                "Find old reflections by month instead of scrolling through everything.",
        },
        {
            title: "OCR for Physical Books",
            description:
                "Take a photo of text from your physical Bible and it'll convert it to text you can work with.",
        },
        {
            title: "Backup & Restore",
            description:
                "Your reflections and notes will be safe even if you switch phones or something goes wrong.",
        },
        {
            title: "Dark Theme",
            description: "Easy on the eyes for evening reading sessions.",
        },
        {
            title: "Better Navigation",
            description:
                "Proper back buttons and navigation that makes sense instead of getting lost in the app.",
        },
    ];

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>What's Coming</Text>
                <Text style={styles.subtitle}>
                    These are list of features I'm working on in my spare time to make
                    this app better and improve your experience using the app.
                </Text>
                <Text style={styles.subtitle}>
                    I can't make promises on a timeline but I will try my best to bring out a new
                    feature every weekend, till they're all released 🙃
                </Text>
            </View>

            {/* Features */}
            {features.map((feature, index) => (
                <View key={index} style={styles.feature}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
            ))}

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Working on these in my spare time. No promises on timeline but
                    they're all coming eventually.
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 24,
        backgroundColor: "#f7f6f3",
        flex: 1,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: "400",
        marginBottom: 8,
        letterSpacing: 1,
        color:"rgb(154, 78, 20)",
    },
    subtitle: {
        fontSize: 14,
        fontWeight: "300",
        lineHeight: 20,
        marginBottom: 15,
        color: COLOR,
    },
    feature: {
        marginBottom: 20,
    },
    featureTitle: {
        fontWeight: "500",
        fontSize: 14,
        marginBottom: 4,
        color: COLOR,
    },
    featureDescription: {
        fontSize: 14,
        lineHeight: 22,
        fontWeight: "300",
        color: COLOR,
    },
    footer: {
        marginTop: 40,
        padding: 12,
    },
    footerText: {
        fontSize: 13,
        marginBottom: 40,
        textAlign: "center",
        fontStyle: "italic",
        color: COLOR,
    },
});

export default UpcomingFeatures;



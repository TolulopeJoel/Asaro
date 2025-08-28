import { Link } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Àṣàrò</Text>
        <View style={styles.titleUnderline} />
      </View>

      <Text style={styles.subtitle}>
        track your bible study reading + meditation
      </Text>

      <View style={styles.buttonContainer}>
        <Link href="/addEntry" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>add entry 🧘</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/browse" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>past entries</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View style={styles.ornament} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#f7f6f3", // warm off-white, like aged paper
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "300", // lighter weight for subtlety
    color: "#2d2520", // deep warm brown
    letterSpacing: 2,
    textAlign: "center",
  },
  titleUnderline: {
    width: 60,
    height: 1,
    backgroundColor: "#8b7355", // muted brown
    marginTop: 8,
    opacity: 0.6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "300",
    color: "#6b5d52", // warm gray-brown
    marginBottom: 48,
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 16,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#4a4037", // deep warm brown
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 2, // minimal rounding
    minWidth: 160,
    alignItems: "center",
    // subtle shadow
    shadowColor: "#2d2520",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  primaryButtonText: {
    color: "#f8f6f0",
    fontSize: 14,
    fontWeight: "300",
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#8b7355",
    borderRadius: 2,
    minWidth: 160,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#4a4037",
    fontSize: 14,
    fontWeight: "300",
    letterSpacing: 1,
  },
  ornament: {
    position: "absolute",
    bottom: 48,
    width: 1,
    height: 24,
    backgroundColor: "#8b7355",
    opacity: 0.3,
  },
});
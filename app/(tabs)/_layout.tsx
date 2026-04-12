import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // single-tab app, no tab bar needed
      }}
    >
      <Tabs.Screen name="index" />
    </Tabs>
  );
}

<script setup lang="ts">
import { RouteName } from '../navigation.ts';
</script>

<template>
  <h1>Page not found</h1>
  <p>
    There's nothing at this address.
    <RouterLink :to="{ name: RouteName.Readings }">Go to the readings</RouterLink>
  </p>
</template>

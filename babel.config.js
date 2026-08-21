module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@db': './src/db',
            '@models': './src/models',
            '@views': './src/views',
            '@controllers': './src/controllers',
            '@services': './src/services',
            '@stores': './src/stores',
            '@components': './src/components',
            '@theme': './src/theme',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@constants': './src/constants',
            '@storage': './src/storage',
            '@i18n': './src/i18n',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // Inlines raw `.sql` files as string constants at build time, so SQL
      // migrations live in `.sql` files (single source of truth, editor
      // highlighting) yet ship without a runtime Metro asset loader.
      ['babel-plugin-inline-import', { extensions: ['.sql'] }],
      // Reanimated / worklets plugin must stay LAST (same as Bsuir Time).
      'react-native-reanimated/plugin',
    ],
  };
};

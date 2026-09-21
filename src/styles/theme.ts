// Gradient themes for consistent design
export const gradients = {
  primary: 'from-cyan-500 via-blue-500 to-purple-600',
  primaryHover: 'from-cyan-400 via-blue-400 to-purple-500',
  card: 'from-cyan-500/10 via-blue-500/10 to-purple-500/10',
  text: 'from-cyan-400 via-blue-400 to-purple-500',
  cyan: 'from-cyan-500 to-blue-600',
  emerald: 'from-emerald-500 to-green-600',
  purple: 'from-purple-500 to-pink-600',
  violet: 'from-violet-500 to-purple-600',
  red: 'from-red-500 to-rose-600',
  amber: 'from-amber-500 to-orange-600',
};

// Card styles
export const cardStyles = {
  base: 'bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-gray-700 transition-all duration-300',
  interactive: 'bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl hover:border-gray-700 hover:shadow-xl transition-all duration-300 cursor-pointer',
  highlight: 'bg-gray-900/40 backdrop-blur-sm border border-cyan-500/30 rounded-2xl hover:border-cyan-500/50 transition-all duration-300',
  glass: 'bg-gray-900/20 backdrop-blur-xl border border-gray-800/50 rounded-2xl',
};

// Button styles
export const buttonStyles = {
  primary: `bg-gradient-to-r ${gradients.primary} text-white font-medium hover:${gradients.primaryHover} transition-all duration-300 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40`,
  secondary: 'bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-300',
  danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white font-medium hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg shadow-red-500/20',
  success: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium hover:from-emerald-600 hover:to-green-700 transition-all duration-300 shadow-lg shadow-emerald-500/20',
};

// Icon container styles
export const iconContainerStyles = {
  cyan: `w-10 h-10 rounded-xl bg-gradient-to-br ${gradients.cyan} flex items-center justify-center shadow-lg`,
  emerald: `w-10 h-10 rounded-xl bg-gradient-to-br ${gradients.emerald} flex items-center justify-center shadow-lg`,
  purple: `w-10 h-10 rounded-xl bg-gradient-to-br ${gradients.purple} flex items-center justify-center shadow-lg`,
  violet: `w-10 h-10 rounded-xl bg-gradient-to-br ${gradients.violet} flex items-center justify-center shadow-lg`,
  red: `w-10 h-10 rounded-xl bg-gradient-to-br ${gradients.red} flex items-center justify-center shadow-lg`,
};

// Text styles
export const textStyles = {
  title: `text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${gradients.text}`,
  subtitle: 'text-gray-400 text-lg',
  heading: 'text-white font-bold text-lg',
  label: 'text-gray-400 text-sm',
  value: 'text-white font-bold',
};

// Status colors
export const statusColors = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  suspended: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  expired: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  banned: 'text-red-400 bg-red-500/10 border-red-500/20',
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
  info: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
};

// Animation classes
export const animations = {
  fadeIn: 'animate-in fade-in duration-500',
  slideIn: 'animate-in slide-in-from-bottom-4 duration-500',
  scaleIn: 'animate-in zoom-in-95 duration-300',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
};

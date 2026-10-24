/**
 * Flutterin Intermediate Representation (IR)
 * Unifies UI, Data Models, and Navigation extracted from diverse target platforms.
 */

export type WidgetType =
  | 'Column'
  | 'Row'
  | 'Stack'
  | 'Container'
  | 'Padding'
  | 'SingleChildScrollView'
  | 'ListView'
  | 'GridView'
  | 'Text'
  | 'ElevatedButton'
  | 'TextButton'
  | 'OutlinedButton'
  | 'IconButton'
  | 'FloatingActionButton'
  | 'TextField'
  | 'Image'
  | 'Icon'
  | 'Card'
  | 'CircularProgressIndicator'
  | 'LinearProgressIndicator'
  | 'Divider'
  | 'Switch'
  | 'Checkbox'
  | 'Radio'
  | 'Slider'
  | 'DropdownButton'
  | 'Chip'
  | 'AppBar'
  | 'BottomNavigationBar'
  | 'TabBar'
  | 'Drawer'
  | 'Wrap'
  | 'CustomPaint'
  | 'PlatformView'
  | 'SizedBox'
  | 'Spacer'
  | 'Custom';

export type ConversionStrategyTier =
  | 'PURE_FLUTTER'
  | 'ECOSYSTEM_PLUGIN'
  | 'HYBRID_BRIDGE'
  | 'CUSTOM_BUILD_FROM_SCRATCH';

export interface InteractiveEscalationOption {
  optionId: 'pure_flutter_custom' | 'hybrid_native_bridge' | 'ecosystem_alternative' | 'simplified_mock';
  label: string;
  description: string;
  recommendedPackages?: string[];
}

export interface InteractiveEscalationSpec {
  id: string;
  sourceConstruct: string;
  sourcePlatform: 'android' | 'ios' | 'react' | 'web' | 'electron' | 'native';
  reason: string;
  recommendedTier: ConversionStrategyTier;
  estimatedEffort: 'low' | 'medium' | 'heavy_custom_build';
  requiresUserConfirmation: boolean;
  options: InteractiveEscalationOption[];
}

export interface WidgetPropertyMap {
  text?: string;
  hintText?: string;
  width?: number | 'infinity';
  height?: number | 'infinity';
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  margin?: { top?: number; bottom?: number; left?: number; right?: number };
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'bold' | 'normal' | 'w500' | 'w600' | 'w700';
  alignment?: 'center' | 'start' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly';
  crossAlignment?: 'center' | 'start' | 'end' | 'stretch';
  src?: string;
  iconName?: string;
  borderRadius?: number;
  elevation?: number;
  isExpanded?: boolean;
  isRow?: boolean;
  isColumn?: boolean;
  flex?: number;
  [key: string]: unknown;
}

export interface WidgetNode {
  id?: string;
  type: WidgetType;
  properties: WidgetPropertyMap;
  children: WidgetNode[];
  rawSourceType?: string;
  conversionTier?: ConversionStrategyTier;
  recommendedPackages?: string[];
  escalation?: InteractiveEscalationSpec;
}

export interface ModelField {
  name: string;
  jsonKey?: string;
  dartType: string;
  isNullable: boolean;
  isList: boolean;
  description?: string;
}

export interface DataModel {
  name: string;
  fields: ModelField[];
  sourceUrlOrEntity?: string;
  subModels?: DataModel[];
}

export interface RouteDefinition {
  path: string;
  screenName: string;
  parameters?: string[];
  isInitial?: boolean;
}

export interface ThemeTokens {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  fontFamily?: string;
}

export interface FlutterProjectIR {
  appName: string;
  packageName: string;
  routes: RouteDefinition[];
  models: DataModel[];
  screens: {
    screenName: string;
    rootWidget: WidgetNode;
  }[];
  theme: ThemeTokens;
}

import 'package:flutter/material.dart';

import '../theme/raja_colors.dart';

/// A soft, elevated surface card in the Raja style.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.gradient,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(20);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: gradient == null ? RajaColors.surface : null,
        gradient: gradient,
        borderRadius: radius,
        border: Border.all(color: RajaColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

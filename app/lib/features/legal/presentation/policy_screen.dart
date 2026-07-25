import 'package:flutter/material.dart';

import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/gradient_background.dart';
import '../legal_content.dart';

/// An in-app, scrollable content screen for policy / informational text
/// (Terms, Privacy Policy, About Us). Renders a lightweight markdown-ish
/// [content] string:
///   - `# heading`    → section title
///   - `## heading`   → sub-heading
///   - `- bullet`     → bulleted line
///   - blank line     → paragraph break
///   - anything else  → body paragraph
///
/// A draft-notice banner is shown at the top since this copy is pending legal
/// review (see [LegalContent]).
class PolicyScreen extends StatelessWidget {
  const PolicyScreen({super.key, required this.title, required this.content});

  final String title;
  final String content;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: <Widget>[
              const _DraftBanner(),
              const SizedBox(height: 16),
              ..._render(context, content),
              const SizedBox(height: 24),
              const Text(
                LegalContent.lastUpdated,
                style: TextStyle(
                  color: RajaColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _render(BuildContext context, String source) {
    final List<Widget> widgets = <Widget>[];
    final List<String> lines = source.trim().split('\n');

    for (final String raw in lines) {
      final String line = raw.trimRight();
      if (line.isEmpty) {
        widgets.add(const SizedBox(height: 12));
      } else if (line.startsWith('## ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 6),
          child: Text(
            line.substring(3),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: RajaColors.gold,
            ),
          ),
        ));
      } else if (line.startsWith('# ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            line.substring(2),
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: RajaColors.textPrimary,
            ),
          ),
        ));
      } else if (line.startsWith('- ')) {
        widgets.add(_Bullet(text: line.substring(2)));
      } else {
        widgets.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(
            line,
            style: const TextStyle(
              color: RajaColors.textSecondary,
              height: 1.55,
              fontSize: 14.5,
            ),
          ),
        ));
      }
    }
    return widgets;
  }
}

class _DraftBanner extends StatelessWidget {
  const _DraftBanner();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      padding: EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.info_outline_rounded,
              color: RajaColors.amber, size: 20),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              LegalContent.draftNotice,
              style: TextStyle(
                color: RajaColors.textSecondary,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Padding(
            padding: EdgeInsets.only(top: 7, right: 10),
            child: Icon(Icons.circle, size: 6, color: RajaColors.gold),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: RajaColors.textSecondary,
                height: 1.5,
                fontSize: 14.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/feedback.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import 'feedback_controller.dart';

/// H4 — send feedback / a complaint, and review your own submissions with their
/// status and any admin reply.
class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _subject = TextEditingController();
  final TextEditingController _message = TextEditingController();
  FeedbackType _type = FeedbackType.feedback;
  bool _submitting = false;

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _submitting) return;
    FocusScope.of(context).unfocus();
    setState(() => _submitting = true);
    try {
      await ref.read(feedbackControllerProvider.notifier).submit(
            type: _type,
            subject: _subject.text.trim(),
            message: _message.text.trim(),
          );
      if (!mounted) return;
      _subject.clear();
      _message.clear();
      setState(() => _type = FeedbackType.feedback);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks! Your message has been sent.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<FeedbackEntry>> mine =
        ref.watch(feedbackControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Feedback & Support')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: <Widget>[
              _FormCard(
                formKey: _formKey,
                subject: _subject,
                message: _message,
                type: _type,
                submitting: _submitting,
                onTypeChanged: (FeedbackType t) => setState(() => _type = t),
                onSubmit: _submit,
              ),
              const SizedBox(height: 28),
              const Text(
                'Your submissions',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: RajaColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              AsyncValueView<List<FeedbackEntry>>(
                value: mine,
                onRetry: () =>
                    ref.read(feedbackControllerProvider.notifier).refresh(),
                data: (List<FeedbackEntry> items) {
                  if (items.isEmpty) {
                    return const _EmptySubmissions();
                  }
                  return Column(
                    children: <Widget>[
                      for (final FeedbackEntry f in items) ...<Widget>[
                        _SubmissionCard(item: f),
                        const SizedBox(height: 12),
                      ],
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FormCard extends StatelessWidget {
  const _FormCard({
    required this.formKey,
    required this.subject,
    required this.message,
    required this.type,
    required this.submitting,
    required this.onTypeChanged,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController subject;
  final TextEditingController message;
  final FeedbackType type;
  final bool submitting;
  final ValueChanged<FeedbackType> onTypeChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const Text(
              'How can we help?',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: RajaColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Tell us what you love or report a problem. We read every message.',
              style: TextStyle(color: RajaColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 18),
            _TypeSelector(selected: type, onChanged: onTypeChanged),
            const SizedBox(height: 16),
            TextFormField(
              controller: subject,
              textInputAction: TextInputAction.next,
              maxLength: 120,
              decoration: const InputDecoration(
                labelText: 'Subject',
                counterText: '',
              ),
              validator: (String? v) {
                final String value = (v ?? '').trim();
                if (value.length < 3) return 'Add a short subject';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: message,
              maxLines: 5,
              maxLength: 2000,
              decoration: const InputDecoration(
                labelText: 'Message',
                alignLabelWithHint: true,
              ),
              validator: (String? v) {
                final String value = (v ?? '').trim();
                if (value.length < 5) return 'Please add a bit more detail';
                return null;
              },
            ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: 'Send',
              icon: Icons.send_rounded,
              loading: submitting,
              onPressed: onSubmit,
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeSelector extends StatelessWidget {
  const _TypeSelector({required this.selected, required this.onChanged});

  final FeedbackType selected;
  final ValueChanged<FeedbackType> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: _TypeChip(
            label: 'Feedback',
            icon: Icons.favorite_rounded,
            active: selected == FeedbackType.feedback,
            onTap: () => onChanged(FeedbackType.feedback),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _TypeChip(
            label: 'Complaint',
            icon: Icons.report_problem_rounded,
            active: selected == FeedbackType.complaint,
            onTap: () => onChanged(FeedbackType.complaint),
          ),
        ),
      ],
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: active
              ? RajaColors.gold.withValues(alpha: 0.16)
              : RajaColors.surfaceHigh,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: active
                ? RajaColors.gold.withValues(alpha: 0.6)
                : RajaColors.border,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Icon(
              icon,
              size: 18,
              color: active ? RajaColors.gold : RajaColors.textMuted,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: active ? RajaColors.gold : RajaColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmissionCard extends StatelessWidget {
  const _SubmissionCard({required this.item});

  final FeedbackEntry item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(
                item.type == FeedbackType.complaint
                    ? Icons.report_problem_rounded
                    : Icons.favorite_rounded,
                size: 16,
                color: RajaColors.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: RajaColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _StatusChip(status: item.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.message,
            style: const TextStyle(color: RajaColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 8),
          Text(
            Formatters.dateTime(item.createdAt),
            style: const TextStyle(color: RajaColors.textMuted, fontSize: 12),
          ),
          if (item.adminReply != null && item.adminReply!.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: RajaColors.surfaceHigh,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: RajaColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Row(
                    children: <Widget>[
                      Icon(Icons.support_agent_rounded,
                          size: 16, color: RajaColors.gold),
                      SizedBox(width: 8),
                      Text(
                        'Cash Raja team',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: RajaColors.gold,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item.adminReply!,
                    style: const TextStyle(
                      color: RajaColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final String label;
    switch (status) {
      case 'resolved':
        color = RajaColors.emerald;
        label = 'Resolved';
      case 'in_review':
        color = RajaColors.sky;
        label = 'In review';
      default:
        color = RajaColors.amber;
        label = 'Open';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _EmptySubmissions extends StatelessWidget {
  const _EmptySubmissions();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Row(
        children: <Widget>[
          Icon(Icons.inbox_rounded, color: RajaColors.textMuted),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'No submissions yet. Your feedback and its status will appear here.',
              style: TextStyle(color: RajaColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

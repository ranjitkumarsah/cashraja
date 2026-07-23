import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../../core/config/app_config.dart';

/// A reusable AdMob banner (G1). Renders nothing when ads are mocked or the ad
/// fails to load, so screens can drop it in unconditionally without reserving
/// layout space for an ad that may never fill.
///
/// Dev uses Google's test banner id (see [AppConfig.admobBannerId]); release
/// supplies the real id via `--dart-define=ADMOB_BANNER_ID`.
class BannerAdWidget extends StatefulWidget {
  const BannerAdWidget({super.key, this.adUnitId});

  final String? adUnitId;

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _banner;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    if (!AppConfig.useMockAds) {
      _load();
    }
  }

  void _load() {
    final BannerAd banner = BannerAd(
      adUnitId: widget.adUnitId ?? AppConfig.admobBannerId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) {
          if (mounted) setState(() => _loaded = true);
        },
        onAdFailedToLoad: (Ad ad, LoadAdError error) {
          ad.dispose();
          if (mounted) setState(() => _loaded = false);
        },
      ),
    );
    _banner = banner;
    banner.load();
  }

  @override
  void dispose() {
    _banner?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final BannerAd? banner = _banner;
    if (!_loaded || banner == null) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      width: banner.size.width.toDouble(),
      height: banner.size.height.toDouble(),
      child: AdWidget(ad: banner),
    );
  }
}

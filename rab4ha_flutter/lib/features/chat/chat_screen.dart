import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';

import '../../core/network/socket_service.dart';

import '../../core/theme/rab4ha_theme.dart';

import '../../shared/widgets/player_avatar.dart';

import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';
import 'chat_profile_sheet.dart';



class ChatScreen extends ConsumerStatefulWidget {

  const ChatScreen({super.key});



  @override

  ConsumerState<ChatScreen> createState() => _ChatScreenState();

}



class _ChatScreenState extends ConsumerState<ChatScreen> with SingleTickerProviderStateMixin {

  late TabController _tabs;

  List<dynamic> _public = [];

  List<dynamic> _conversations = [];

  List<dynamic> _dmMessages = [];

  String? _dmUserId;

  String? _dmName;

  final _input = TextEditingController();

  var _channel = 'public';
  Map<String, dynamic>? _replyTo;
  String? _pendingImageUrl;
  StreamSubscription<Map<String, dynamic>>? _msgSub;



  @override

  void initState() {

    super.initState();

    _tabs = TabController(length: 2, vsync: this);

    _tabs.addListener(() {

      if (!_tabs.indexIsChanging) {

        setState(() => _channel = _tabs.index == 0 ? 'public' : 'dm');

      }

    });

    WidgetsBinding.instance.addPostFrameCallback((_) => _init());

  }



  Future<void> _init() async {

    final token = ref.read(authProvider).token;

    if (token != null) {

      ref.read(socketServiceProvider).emitChatAuth(token);

    }

    _msgSub = ref.read(socketServiceProvider).on<Map<String, dynamic>>('chat:message').listen((d) {

      if (!mounted) return;

      if (d['channel'] == 'public' && _channel == 'public') {

        setState(() => _public = [..._public, d['message']]);

      } else if (d['channel'] == 'dm') {

        final msg = d['message'] as Map?;

        if (msg?['recipient_id']?.toString() == _dmUserId ||

            msg?['sender']?['user_id']?.toString() == _dmUserId) {

          setState(() => _dmMessages = [..._dmMessages, msg]);

        }

      }

    });

    await _loadPublic();
    await _loadDmList();
    final qp = GoRouterState.of(context).uri.queryParameters;
    final dmId = qp['dm'];
    if (dmId != null && dmId.isNotEmpty && mounted) {
      await _openDm(dmId, qp['name'] ?? '');
    }
  }



  Future<void> _loadPublic() async {

    final api = ref.read(apiClientProvider);

    final res = await api.get('/api/chat/public');

    final data = await api.parseJson(res);

    setState(() => _public = data['messages'] as List? ?? []);

  }



  Future<void> _loadDmList() async {

    final api = ref.read(apiClientProvider);

    final res = await api.get('/api/chat/dm');

    final data = await api.parseJson(res);

    setState(() => _conversations = data['conversations'] as List? ?? []);

  }



  Future<void> _openDm(String userId, String name) async {

    final api = ref.read(apiClientProvider);

    final res = await api.get('/api/chat/dm/$userId');

    final data = await api.parseJson(res);

    setState(() {

      _dmUserId = userId;

      _dmName = name;

      _dmMessages = data['messages'] as List? ?? [];

      _channel = 'dm';

      _tabs.index = 1;

    });

  }



  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty && _pendingImageUrl == null) return;
    _input.clear();
    final api = ref.read(apiClientProvider);
    final body = <String, dynamic>{
      if (text.isNotEmpty) 'body': text,
      if (_pendingImageUrl != null) 'image_url': _pendingImageUrl,
      if (_replyTo?['id'] != null) 'reply_to_id': _replyTo!['id'],
    };
    _pendingImageUrl = null;
    _replyTo = null;
    if (_channel == 'public') {
      final res = await api.post('/api/chat/public', body: body);
      final data = await api.parseJson(res);
      setState(() => _public = [..._public, data['message']]);
    } else if (_dmUserId != null) {
      final res = await api.post('/api/chat/dm/$_dmUserId', body: body);
      final data = await api.parseJson(res);
      setState(() => _dmMessages = [..._dmMessages, data['message']]);
    }
  }

  Future<void> _pickImage() async {
    if (_channel != 'dm' || _dmUserId == null) return;
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    final dataUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    final api = ref.read(apiClientProvider);
    final res = await api.post('/api/chat/upload', body: {'data': dataUrl});
    final data = await api.parseJson(res);
    setState(() => _pendingImageUrl = data['url']?.toString());
    if (mounted) {
      ref.read(homeToastProvider.notifier).show('تم إرفاق الصورة — اضغط إرسال');
    }
  }

  void _setReply(Map m) {
    setState(() => _replyTo = Map<String, dynamic>.from(m));
  }

  void _clearReply() => setState(() => _replyTo = null);



  @override

  void dispose() {

    _msgSub?.cancel();

    _tabs.dispose();

    _input.dispose();

    super.dispose();

  }



  @override

  Widget build(BuildContext context) {

    final c = rab4haColors(context);

    return Scaffold(

      appBar: AppBar(

        title: Text(_channel == 'dm' && _dmName != null ? _dmName! : 'الشات'),

        bottom: TabBar(

          controller: _tabs,

          tabs: const [Tab(text: 'عام'), Tab(text: 'خاص')],

        ),

      ),

      body: Column(
        children: [
          if (_channel == 'dm' && _dmUserId != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: c.bgElevated,
              child: Text(
                'الرسائل الخاصة تُحذف تلقائياً بعد 48 ساعة',
                style: TextStyle(fontSize: 12, color: c.textMuted),
                textAlign: TextAlign.center,
              ),
            ),
          Expanded(
            child: _channel == 'public' ? _messageList(_public) : _dmBody(),
          ),

          if (_replyTo != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: c.bgElevated,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '↩ ${_replyTo!['body']?.toString().substring(0, (_replyTo!['body']?.toString().length ?? 0).clamp(0, 60))}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(icon: const Icon(Icons.close, size: 18), onPressed: _clearReply),
                ],
              ),
            ),
          if (_pendingImageUrl != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      '${Uri.base.origin}${_pendingImageUrl!.startsWith('/') ? '' : '/'}$_pendingImageUrl',
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.image),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text('صورة مرفقة'),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => _pendingImageUrl = null)),
                ],
              ),
            ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: c.inputBg,
              border: Border(top: BorderSide(color: c.inputBorder)),
            ),
            child: Row(
              children: [
                if (_channel == 'dm' && _dmUserId != null)
                  IconButton(icon: const Icon(Icons.image), onPressed: _pickImage),
                Expanded(
                  child: TextField(
                    controller: _input,
                    decoration: InputDecoration(
                      hintText: 'اكتب رسالة...',
                      filled: true,
                      fillColor: c.inputBg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(icon: const Icon(Icons.send), onPressed: _send),
              ],
            ),
          ),

        ],

      ),

    );

  }



  Widget _dmBody() {

    if (_dmUserId == null) {

      return ListView.builder(

        padding: const EdgeInsets.all(8),

        itemCount: _conversations.length,

        itemBuilder: (_, i) {

          final c = _conversations[i] as Map;

          final user = Map<String, dynamic>.from(c['user'] as Map? ?? {});

          return Card(

            margin: const EdgeInsets.only(bottom: 8),

            child: ListTile(

              leading: PlayerAvatar(data: user, size: 44),

              title: Row(

                children: [

                  Flexible(

                    child: Text(

                      user['name']?.toString() ?? '',

                      overflow: TextOverflow.ellipsis,

                    ),

                  ),

                  buildStatusBadgeFromMap(user),

                ],

              ),

              subtitle: Column(

                crossAxisAlignment: CrossAxisAlignment.start,

                children: [

                  buildRankPill(user),

                  const SizedBox(height: 4),

                  Text(

                    c['last_message']?['body']?.toString() ?? '',

                    maxLines: 1,

                    overflow: TextOverflow.ellipsis,

                  ),

                ],

              ),

              onTap: () => _openDm(
                user['user_id']?.toString() ?? '',
                user['name']?.toString() ?? '',
              ),
              onLongPress: () => openChatProfileSheet(
                context,
                ref,
                user['user_id']?.toString() ?? '',
              ),

            ),

          );

        },

      );

    }

    return _messageList(_dmMessages);

  }



  Widget _messageList(List messages) {

    final c = rab4haColors(context);

    return ListView.builder(

      padding: const EdgeInsets.all(12),

      itemCount: messages.length,

      itemBuilder: (_, i) {

        final m = messages[i] as Map;

        final sender = Map<String, dynamic>.from(m['sender'] as Map? ?? {});
        final userId = sender['user_id']?.toString() ?? '';
        final msgId = m['id'] is int ? m['id'] as int : int.tryParse('${m['id']}');

        void openProfile() => openChatProfileSheet(context, ref, userId, messageId: msgId);

        return GestureDetector(
          onLongPress: () => _setReply(m),
          child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: c.inputBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.inputBorder),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: openProfile,
                child: PlayerAvatar(data: sender, size: 44, vipFrame: true),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: openProfile,
                      behavior: HitTestBehavior.opaque,
                      child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            sender['name']?.toString() ?? 'لاعب',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        buildStatusBadgeFromMap(sender, size: 18),
                      ],
                    ),
                    ),
                    const SizedBox(height: 4),
                    buildRankPill(sender),
                    const SizedBox(height: 8),
                    if (m['reply_to'] is Map)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          '↩ ${(m['reply_to'] as Map)['body']?.toString() ?? ''}',
                          style: TextStyle(color: c.textMuted, fontSize: 12),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    if (m['image_url'] != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            m['image_url'].toString().startsWith('http')
                                ? m['image_url'].toString()
                                : '${Uri.base.origin}${m['image_url']}',
                            height: 120,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(Icons.broken_image),
                          ),
                        ),
                      ),
                    if ((m['body']?.toString() ?? '').isNotEmpty)
                      Text(
                        m['body']?.toString() ?? '',
                        style: TextStyle(color: c.textPrimary, height: 1.4),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        );

      },

    );

  }

}



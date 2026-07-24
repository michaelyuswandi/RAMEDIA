#include <cstddef>

#include <Processing.NDI.Lib.h>

#include <atomic>
#include <csignal>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <vector>

namespace {

std::atomic_bool keep_running(true);

struct HelperOptions {
  std::string source_name = "RAMEDIA Output";
  int width = 1920;
  int height = 1080;
  int fps = 30;
  bool alpha_enabled = false;
};

void handle_signal(int) {
  keep_running = false;
}

std::string read_arg(int argc, char* argv[], const char* name, const std::string& fallback) {
  for (int i = 1; i + 1 < argc; ++i) {
    if (std::strcmp(argv[i], name) == 0) {
      return argv[i + 1];
    }
  }
  return fallback;
}

int read_int_arg(int argc, char* argv[], const char* name, int fallback) {
  const std::string value = read_arg(argc, argv, name, "");
  if (value.empty()) return fallback;
  char* end = nullptr;
  const long parsed = std::strtol(value.c_str(), &end, 10);
  if (!end || *end != '\0') return fallback;
  return static_cast<int>(parsed);
}

bool has_arg(int argc, char* argv[], const char* name) {
  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], name) == 0) return true;
  }
  return false;
}

HelperOptions parse_options(int argc, char* argv[]) {
  HelperOptions options;
  options.source_name = read_arg(argc, argv, "--source-name", options.source_name);
  options.fps = read_int_arg(argc, argv, "--fps", options.fps);
  options.alpha_enabled = has_arg(argc, argv, "--alpha");

  const std::string resolution = read_arg(argc, argv, "--resolution", "1080p");
  if (resolution == "720p") {
    options.width = 1280;
    options.height = 720;
  }

  if (options.fps != 60) {
    options.fps = 30;
  }

  return options;
}

bool read_frame(std::vector<uint8_t>& buffer) {
  size_t received = 0;
  while (keep_running && received < buffer.size()) {
    std::cin.read(reinterpret_cast<char*>(buffer.data() + received),
                  static_cast<std::streamsize>(buffer.size() - received));
    const std::streamsize count = std::cin.gcount();
    if (count <= 0) return false;
    received += static_cast<size_t>(count);
  }
  return received == buffer.size();
}

} // namespace

int main(int argc, char* argv[]) {
  std::signal(SIGINT, handle_signal);
  std::signal(SIGTERM, handle_signal);

  const HelperOptions options = parse_options(argc, argv);

  if (!NDIlib_initialize()) {
    std::cerr << "Failed to initialize NDI runtime." << std::endl;
    return 1;
  }
  std::cout << "NDI runtime version: " << NDIlib_version()
            << ", supported CPU: " << (NDIlib_is_supported_CPU() ? "yes" : "no") << std::endl;

  NDIlib_send_create_t send_settings(options.source_name.c_str(), NULL, true, false);

  NDIlib_send_instance_t sender = NDIlib_send_create(&send_settings);
  if (!sender) {
    sender = NDIlib_send_create();
  }
  if (!sender) {
    std::cerr << "Failed to create NDI sender." << std::endl;
    NDIlib_destroy();
    return 1;
  }

  std::vector<uint8_t> frame_buffer(static_cast<size_t>(options.width) * static_cast<size_t>(options.height) * 4);
  NDIlib_video_frame_v2_t frame;
  frame.xres = options.width;
  frame.yres = options.height;
  frame.FourCC = options.alpha_enabled ? NDIlib_FourCC_type_BGRA : NDIlib_FourCC_type_BGRX;
  frame.frame_rate_N = options.fps * 1000;
  frame.frame_rate_D = 1000;
  frame.picture_aspect_ratio = static_cast<float>(options.width) / static_cast<float>(options.height);
  frame.frame_format_type = NDIlib_frame_format_type_progressive;
  frame.line_stride_in_bytes = options.width * 4;
  frame.p_data = frame_buffer.data();

  std::cout << "RAMEDIA NDI helper live: " << options.source_name << " "
            << options.width << "x" << options.height << "@" << options.fps
            << (options.alpha_enabled ? " BGRA" : " BGRX") << std::endl;

  while (keep_running && read_frame(frame_buffer)) {
    NDIlib_send_send_video_v2(sender, &frame);
  }

  NDIlib_send_destroy(sender);
  NDIlib_destroy();
  return 0;
}

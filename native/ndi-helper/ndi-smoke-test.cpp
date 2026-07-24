#include <cstddef>

#include <Processing.NDI.Lib.h>

#include <chrono>
#include <cstring>
#include <iostream>
#include <thread>

int main(int argc, char* argv[]) {
  const char* expected_name = argc > 1 ? argv[1] : "RAMEDIA-E2E-TEST";
  if (!NDIlib_initialize()) return 2;

  NDIlib_find_create_t find_settings{};
  find_settings.show_local_sources = true;
  NDIlib_find_instance_t finder = NDIlib_find_create_v2(&find_settings);
  if (!finder) return 3;

  NDIlib_source_t selected{};
  bool found = false;
  for (int attempt = 0; attempt < 8 && !found; ++attempt) {
    NDIlib_find_wait_for_sources(finder, 1000);
    uint32_t count = 0;
    const NDIlib_source_t* sources = NDIlib_find_get_current_sources(finder, &count);
    for (uint32_t i = 0; i < count; ++i) {
      if (sources[i].p_ndi_name && std::strstr(sources[i].p_ndi_name, expected_name)) {
        selected = sources[i];
        found = true;
        break;
      }
    }
  }
  if (!found) {
    std::cerr << "Source not found: " << expected_name << std::endl;
    NDIlib_find_destroy(finder);
    NDIlib_destroy();
    return 4;
  }

  NDIlib_recv_create_v3_t receive_settings{};
  receive_settings.source_to_connect_to = selected;
  receive_settings.color_format = NDIlib_recv_color_format_BGRX_BGRA;
  receive_settings.bandwidth = NDIlib_recv_bandwidth_highest;
  receive_settings.allow_video_fields = false;
  NDIlib_recv_instance_t receiver = NDIlib_recv_create_v3(&receive_settings);
  if (!receiver) return 5;

  int result = 6;
  for (int attempt = 0; attempt < 8; ++attempt) {
    NDIlib_video_frame_v2_t video{};
    NDIlib_audio_frame_v3_t audio{};
    NDIlib_metadata_frame_t metadata{};
    const NDIlib_frame_type_e type = NDIlib_recv_capture_v3(receiver, &video, &audio, &metadata, 1000);
    if (type == NDIlib_frame_type_video) {
      std::cout << "received=" << video.xres << "x" << video.yres
                << " fourcc=" << static_cast<uint32_t>(video.FourCC)
                << " stride=" << video.line_stride_in_bytes << std::endl;
      NDIlib_recv_free_video_v2(receiver, &video);
      result = 0;
      break;
    }
    if (type == NDIlib_frame_type_audio) NDIlib_recv_free_audio_v3(receiver, &audio);
    if (type == NDIlib_frame_type_metadata) NDIlib_recv_free_metadata(receiver, &metadata);
  }

  NDIlib_recv_destroy(receiver);
  NDIlib_find_destroy(finder);
  NDIlib_destroy();
  return result;
}

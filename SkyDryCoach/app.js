// app.js
App({
  onLaunch() {
    // 小程序启动时执行
    console.log('晾衣助手小程序启动');
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 获取系统信息
    this.getSystemInfo();
  },
  
  onShow() {
    console.log('晾衣助手小程序显示');
  },
  
  onHide() {
    console.log('晾衣助手小程序隐藏');
  },
  
  // 全局数据
  globalData: {
    userInfo: null,
    systemInfo: null,
    location: null,
    preferences: {
      workStart: '08:00',
      workEnd: '19:00',
      preference: 0.5
    }
  },
  
  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },
  
  // 获取系统信息
  getSystemInfo() {
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
      }
    });
  },
  
  // 天气API配置（使用Open-Meteo免费天气API）
  weatherConfig: {
    openMeteoUrl: 'https://api.open-meteo.com/v1/forecast'
  },

  // 获取天气数据（使用Open-Meteo免费API）
  async fetchWeather(lat, lon, startDate = null) {
    try {
      console.log('开始获取天气数据，坐标:', lat, lon);
      
      // 使用Open-Meteo免费API（无需认证）
      const openMeteoData = await this.fetchOpenMeteoWeather(lat, lon);
      if (openMeteoData) {
        console.log('✅ 使用Open-Meteo天气数据:', openMeteoData);
        return openMeteoData;
      }
      
      // 如果API失败，使用模拟数据
      console.log('⚠️ Open-Meteo API请求失败，使用模拟天气数据');
      const mockData = this.getMockWeatherData(lat, lon);
      console.log('模拟数据:', mockData);
      return mockData;
      
    } catch (error) {
      console.error('❌ 获取天气数据异常:', error);
      const mockData = this.getMockWeatherData(lat, lon);
      console.log('异常后使用模拟数据:', mockData);
      return mockData;
    }
  },
  
  // 使用Open-Meteo免费API获取天气数据
  async fetchOpenMeteoWeather(lat, lon) {
    try {
      const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,precipitation,vapour_pressure_deficit,precipitation_probability',
        daily: 'temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_speed_10m_min,precipitation_sum',
        timezone: 'auto',
        forecast_days: 5
      };
      
      const queryString = Object.keys(params)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
      
      const fullUrl = `${this.weatherConfig.openMeteoUrl}?${queryString}`;
      
      console.log('🌤️ 请求Open-Meteo天气数据:', fullUrl);
      
      const response = await new Promise((resolve) => {
        wx.request({
          url: fullUrl,
          method: 'GET',
          timeout: 10000,
          success: (res) => {
            console.log('📡 Open-Meteo API响应:', res);
            if (res.statusCode === 200 && res.data) {
              console.log('✅ Open-Meteo API响应成功，数据格式:', {
                hasHourly: !!res.data.hourly,
                hasDaily: !!res.data.daily,
                hourlyKeys: res.data.hourly ? Object.keys(res.data.hourly) : [],
                dailyKeys: res.data.daily ? Object.keys(res.data.daily) : []
              });
              resolve(res.data);
            } else {
              console.warn('❌ Open-Meteo API返回非200状态:', res.statusCode);
              resolve(null);
            }
          },
          fail: (err) => {
            console.error('❌ Open-Meteo API请求失败:', err);
            resolve(null);
          }
        });
      });
      
      return response;
    } catch (error) {
      console.error('❌ Open-Meteo API异常:', error);
      return null;
    }
  },
  
  // 计算晾衣指数
  calculateDryingIndex(temp, wind, vpd, humidity, cloud, preference = 0.5) {
    const safetyWeight = (1 - preference);
    const speedWeight = preference;
    
    const index = (
      temp * 1.0 +
      wind * (1.5 + 0.5 * speedWeight) +
      vpd * (1.0 + 0.5 * speedWeight) -
      humidity * (0.5 + 0.5 * safetyWeight) -
      cloud * (0.3 + 0.2 * safetyWeight)
    );
    
    return Math.max(0, Math.min(100, index));
  },
  
  // 处理天气预报数据
  processForecast(data, workStart = '08:00', workEnd = '19:00', preference = 0.5) {
    const forecasts = [];
    const daily = data.daily || {};
    const hourly = data.hourly || {};
    
    // 构建小时数据数组
    const hourlyData = [];
    const times = hourly.time || [];
    
    times.forEach((time, i) => {
      hourlyData.push({
        time,
        temperature_2m: (hourly.temperature_2m || [])[i],
        relative_humidity_2m: (hourly.relative_humidity_2m || [])[i],
        wind_speed_10m: (hourly.wind_speed_10m || [])[i],
        cloud_cover: (hourly.cloud_cover || [])[i],
        precipitation: (hourly.precipitation || [])[i],
        vapour_pressure_deficit: (hourly.vapour_pressure_deficit || [])[i],
        precipitation_probability: (hourly.precipitation_probability || [])[i]
      });
    });
    
    const numDays = (daily.temperature_2m_max || []).length;
    
    for (let i = 0; i < numDays; i++) {
      // 获取每日数据
      const maxTemp = daily.temperature_2m_max?.[i] || 20;
      const minTemp = daily.temperature_2m_min?.[i] || 20;
      const maxWind = daily.wind_speed_10m_max?.[i] || 10;
      const minWind = daily.wind_speed_10m_min?.[i] || 5;
      const totalPrecip = daily.precipitation_sum?.[i] || 0;

      // 过滤当天的每小时数据
      const dayStr = daily.time[i];
      const dayHourly = hourlyData.filter(h => h.time.startsWith(dayStr));

      // 过滤掉空值和无效值用于计算平均值
      const tempVals = dayHourly.map(h => h.temperature_2m).filter(val => val !== null && val !== undefined && !isNaN(val));
      const humidityVals = dayHourly.map(h => h.relative_humidity_2m).filter(val => val !== null && val !== undefined && !isNaN(val));
      const windVals = dayHourly.map(h => h.wind_speed_10m).filter(val => val !== null && val !== undefined && !isNaN(val));
      const cloudVals = dayHourly.map(h => h.cloud_cover).filter(val => val !== null && val !== undefined && !isNaN(val));
      const vpdVals = dayHourly.map(h => h.vapour_pressure_deficit).filter(val => val !== null && val !== undefined && !isNaN(val));

      // 计算平均值（添加调试信息）
      console.log(`🌡️ [${dayStr}] 温度数据调试:`, {
        原始小时数据: dayHourly.length,
        有效温度值: tempVals.length,
        温度数组: tempVals.slice(0, 6), // 显示前6个值
        最高温: maxTemp,
        最低温: minTemp
      });

      const avgTemp = tempVals.length ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length : (maxTemp + minTemp) / 2;
      const avgHumidity = humidityVals.length ? humidityVals.reduce((a, b) => a + b, 0) / humidityVals.length : 50;
      const avgWind = windVals.length ? windVals.reduce((a, b) => a + b, 0) / windVals.length : (maxWind + minWind) / 2;
      const avgCloud = cloudVals.length ? cloudVals.reduce((a, b) => a + b, 0) / cloudVals.length : 50;
      const avgVpd = vpdVals.length ? vpdVals.reduce((a, b) => a + b, 0) / vpdVals.length : 1.0;

      // 工作时间分析
      const workHourData = dayHourly.filter(h => {
        const hour = h.time.substring(11, 16);
        return workStart <= hour && hour <= workEnd;
      });
      
      const rainAlert = workHourData.some(h => (h.precipitation_probability || 0) > 50);
      const maxRainProb = Math.max(...workHourData.map(h => h.precipitation_probability || 0), 0);

      // 计算晾衣指数
      const dryingIndex = this.calculateDryingIndex(avgTemp, avgWind, avgVpd, avgHumidity, avgCloud, preference);

      // 生成建议
      let recommendation, color;
      if (rainAlert || totalPrecip > 0) {
        recommendation = "不建议晾衣 - 有雨";
        color = "red";
      } else if (dryingIndex >= 60) {
        recommendation = "适合晾衣 - 干燥快";
        color = "green";
      } else if (dryingIndex >= 30) {
        recommendation = "谨慎晾衣 - 干燥慢";
        color = "orange";
      } else {
        recommendation = "不适合 - 室内晾干";
        color = "red";
      }

      forecasts.push({
        date: dayStr,
        max_temp: maxTemp,
        min_temp: minTemp,
        avg_temp: avgTemp,
        avg_humidity: avgHumidity,
        avg_wind: avgWind,
        avg_cloud_cover: avgCloud,
        avg_vpd: avgVpd,
        rain_probability: maxRainProb,
        total_precipitation: totalPrecip,
        drying_index: dryingIndex,
        recommendation,
        color,
        rain_alert: rainAlert,
        hourly_data: dayHourly,
        work_hour_data: workHourData,
        // 预计算格式化显示值，避免在WXML中调用方法
        avg_temp_display: Number.isFinite(avgTemp) ? avgTemp.toFixed(1) : '--',
        min_temp_display: Number.isFinite(minTemp) ? Math.round(minTemp).toString() : '--',
        max_temp_display: Number.isFinite(maxTemp) ? Math.round(maxTemp).toString() : '--',
        avg_humidity_display: Number.isFinite(avgHumidity) ? Math.round(avgHumidity).toString() : '--',
        avg_wind_display: Number.isFinite(avgWind) ? avgWind.toFixed(1) : '--',
        rain_probability_display: Number.isFinite(maxRainProb) ? Math.round(maxRainProb).toString() : '0',
        avg_cloud_cover_display: Number.isFinite(avgCloud) ? Math.round(avgCloud).toString() : '--',
        avg_vpd_display: Number.isFinite(avgVpd) ? avgVpd.toFixed(2) : '--',
        total_precipitation_display: Number.isFinite(totalPrecip) ? totalPrecip.toFixed(1) : '0.0',
        drying_index_display: Number.isFinite(dryingIndex) ? Math.round(dryingIndex).toString() : '0'
      });
    }

    return forecasts;
  },
  
  // 工具函数
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  getEndDate(startDate, daysToAdd) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + daysToAdd);
    return this.formatDate(date);
  },
  
  // 获取中文星期
  getChineseWeekday(date) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  },
  
  // 测试天气API连接
  async testWeatherAPI() {
    try {
      // 测试Open-Meteo API
      console.log('测试Open-Meteo API...');
      const openMeteoResult = await this.fetchOpenMeteoWeather(39.9042, 116.4074); // 北京坐标
      
      if (openMeteoResult) {
        return { 
          valid: true, 
          api: 'Open-Meteo', 
          message: 'Open-Meteo API连接成功' 
        };
      }
      
      return { 
        valid: false, 
        api: 'None', 
        message: 'Open-Meteo API连接失败，将使用模拟数据' 
      };
      
    } catch (error) {
      console.error('天气API测试异常:', error);
      return { 
        valid: false, 
        api: 'Error', 
        message: `测试异常: ${error.message}` 
      };
    }
  },

  // 生成模拟天气数据（备用方案）
  getMockWeatherData(lat, lon) {
    console.log('使用模拟天气数据');
    
    const now = new Date();
    const startDate = this.formatDate(now);
    const endDate = this.getEndDate(startDate, 4);
    
    // 生成模拟数据
    const hourlyData = [];
    const dailyData = [];
    
    // 生成5天的数据
    for (let i = 0; i < 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDate(date);
      
      // 根据季节和地理位置生成合理的温度范围
      const month = date.getMonth() + 1;
      let baseTemp = 20; // 默认温度
      if (month >= 3 && month <= 5) baseTemp = 18; // 春季
      else if (month >= 6 && month <= 8) baseTemp = 28; // 夏季
      else if (month >= 9 && month <= 11) baseTemp = 15; // 秋季
      else baseTemp = 5; // 冬季
      
      // 根据纬度调整温度
      if (lat > 30) baseTemp -= 5; // 北方较冷
      else if (lat < 20) baseTemp += 5; // 南方较热
      
      const maxTemp = baseTemp + Math.random() * 8 + 2;
      const minTemp = baseTemp - Math.random() * 8 - 2;
      const avgTemp = (maxTemp + minTemp) / 2;
      
      dailyData.push({
        time: dateStr,
        temperature_2m_max: [maxTemp],
        temperature_2m_min: [minTemp],
        wind_speed_10m_max: [Math.random() * 10 + 5],
        wind_speed_10m_min: [Math.random() * 5 + 2],
        precipitation_sum: [Math.random() * 5]
      });
      
      // 生成24小时数据
      for (let hour = 0; hour < 24; hour++) {
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        hourlyData.push({
          time: `${dateStr}T${hourStr}`,
          temperature_2m: avgTemp + Math.sin(hour / 24 * Math.PI * 2) * 8,
          relative_humidity_2m: 50 + Math.random() * 30,
          wind_speed_10m: Math.random() * 8 + 2,
          cloud_cover: Math.random() * 100,
          precipitation: Math.random() * 2,
          vapour_pressure_deficit: Math.random() * 2 + 0.5,
          precipitation_probability: Math.random() * 50
        });
      }
    }
    
    return {
      latitude: lat,
      longitude: lon,
      generationtime_ms: 0,
      utc_offset_seconds: 28800,
      timezone: 'Asia/Shanghai',
      timezone_abbreviation: 'CST',
      elevation: 50,
      hourly_units: {
        time: 'iso8601',
        temperature_2m: '°C',
        relative_humidity_2m: '%',
        wind_speed_10m: 'km/h',
        cloud_cover: '%',
        precipitation: 'mm',
        vapour_pressure_deficit: 'kPa',
        precipitation_probability: '%'
      },
      hourly: {
        time: hourlyData.map(h => h.time),
        temperature_2m: hourlyData.map(h => h.temperature_2m),
        relative_humidity_2m: hourlyData.map(h => h.relative_humidity_2m),
        wind_speed_10m: hourlyData.map(h => h.wind_speed_10m),
        cloud_cover: hourlyData.map(h => h.cloud_cover),
        precipitation: hourlyData.map(h => h.precipitation),
        vapour_pressure_deficit: hourlyData.map(h => h.vapour_pressure_deficit),
        precipitation_probability: hourlyData.map(h => h.precipitation_probability)
      },
      daily_units: {
        time: 'iso8601',
        temperature_2m_max: '°C',
        temperature_2m_min: '°C',
        wind_speed_10m_max: 'km/h',
        wind_speed_10m_min: 'km/h',
        precipitation_sum: 'mm'
      },
      daily: {
        time: dailyData.map(d => d.time),
        temperature_2m_max: dailyData.map(d => d.temperature_2m_max[0]),
        temperature_2m_min: dailyData.map(d => d.temperature_2m_min[0]),
        wind_speed_10m_max: dailyData.map(d => d.wind_speed_10m_max[0]),
        wind_speed_10m_min: dailyData.map(d => d.wind_speed_10m_min[0]),
        precipitation_sum: dailyData.map(d => d.precipitation_sum[0])
      }
    };
  }
})